import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabaseDriver, queryAll, queryOne, runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";
import { recordCreditReview } from "@/lib/reward-credit-review";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("orders");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const orderId = Number(id);
  const order = await queryOne(`SELECT * FROM orders WHERE id = ?`, orderId);
  if (!order) {
    return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
  }

  const items = await queryAll(
    `SELECT * FROM order_items WHERE order_id = ?`,
    orderId
  );

  return NextResponse.json({ order, items });
}

const patchOrderSchema = z.object({
  status: z.enum([
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ]),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("orders");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const orderId = Number(id);
  const existing = await queryOne<{ id: number; status: string }>(
    `SELECT id, status FROM orders WHERE id = ?`,
    orderId
  );
  if (!existing) {
    return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = patchOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "حالة الطلب غير صالحة." },
      { status: 400 }
    );
  }

  const nextStatus = parsed.data.status;
  // Preserve existing order operations until the additive rewards migration is applied.
  const rewardsInstalled = nextStatus !== "delivered" && Boolean(await queryOne(
    getDatabaseDriver() === "postgres"
      ? `SELECT 1 AS present WHERE to_regclass('public.aura_reward_grants') IS NOT NULL`
      : `SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'aura_reward_grants'`
  ));

  if (rewardsInstalled && nextStatus === "cancelled") {
    const reviewInstalled = await queryOne(getDatabaseDriver() === "postgres"
      ? `SELECT 1 AS present WHERE to_regclass('public.aura_reward_credit_review_incidents') IS NOT NULL AND to_regclass('public.aura_reward_credit_restorations') IS NOT NULL`
      : `SELECT 1 AS present WHERE (SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('aura_reward_credit_review_incidents', 'aura_reward_credit_restorations')) = 2`);
    if (!reviewInstalled) return NextResponse.json({ error: "تعذر تحديث الطلب قبل اكتمال تهيئة سجل مراجعة الرصيد." }, { status: 503 });
  }

  await runTransaction(async (tx) => {
    // Serialize status changes with claims and with other status updates.
    const locked = await tx.queryOne<{ status: string }>(
      `SELECT status FROM orders WHERE id = ?${getDatabaseDriver() === "postgres" ? " FOR UPDATE" : ""}`,
      orderId
    );
    if (!locked) throw new Error("Order no longer exists");
    // If transitioning to cancelled from a non-cancelled state, restore product stock
    if (nextStatus === "cancelled" && locked.status !== "cancelled") {
      const items = await tx.queryAll<{ product_id: number; quantity: number }>(
        `SELECT product_id, quantity FROM order_items WHERE order_id = ? AND product_id IS NOT NULL`,
        orderId
      );
      for (const it of items) {
        await tx.execute(
          `UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?`,
          it.quantity,
          it.product_id
        );
      }
    }

    const paymentStatus =
      nextStatus === "delivered"
        ? "paid"
        : nextStatus === "cancelled"
        ? "cancelled"
        : "pending";

    await tx.execute(
      `UPDATE orders SET status = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?`,
      nextStatus,
      paymentStatus,
      orderId
    );

    if (rewardsInstalled) {
      if (nextStatus === "cancelled") await recordCreditReview(tx, orderId, "cancelled", getDatabaseDriver());
      const grant = await tx.queryOne<{ id: number; reward_id: number; kind: string }>(
        `SELECT g.id, g.reward_id, g.kind FROM aura_reward_grants g
         JOIN aura_reward_grant_orders go ON go.grant_id = g.id
         WHERE go.order_id = ? AND go.released_at IS NULL`, orderId
      );
      if (grant) {
        // Revoke only an unused reward. A partially spent credit is an auditable exception.
        const revoked = await tx.execute(
          `UPDATE aura_reward_grants SET status = 'revoked', revoked_at = datetime('now')
           WHERE id = ? AND status IN ('available', 'expired') AND (kind <> 'credit' OR remaining_iqd = credit_iqd)`, grant.id
        );
        if (revoked.changes === 1) {
          if (grant.kind !== "credit") {
            await tx.execute(`UPDATE aura_reward_definitions SET stock_quantity = stock_quantity + 1 WHERE id = ?`, grant.reward_id);
          }
          await tx.execute(`UPDATE aura_reward_grant_orders SET released_at = datetime('now') WHERE grant_id = ? AND released_at IS NULL`, grant.id);
        } else {
          await tx.execute(
            `INSERT OR IGNORE INTO aura_reward_incidents (order_id, grant_id, reason) VALUES (?, ?, ?)`,
            orderId, grant.id, "order_no_longer_eligible_after_reward_use"
          );
        }
      }
    }
  });

  return NextResponse.json({ message: "تم تحديث حالة الطلب بنجاح." });
}
