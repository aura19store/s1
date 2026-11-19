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
  expected_status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]).optional(),
  operation_id: z.string().uuid().optional(),
}).refine((value) => !value.operation_id || value.expected_status !== undefined);

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

  const result = await runTransaction(async (tx) => {
    // Lock the order before recording an operation so retries and other status updates serialize.
    const locked = await tx.queryOne<{ status: string }>(
      `SELECT status FROM orders WHERE id = ?${getDatabaseDriver() === "postgres" ? " FOR UPDATE" : ""}`,
      orderId
    );
    if (!locked) return { code: 404, status: "", error: "الطلب غير موجود." };
    const operationId = parsed.data.operation_id;
    if (operationId) {
      await tx.execute(
        `INSERT OR IGNORE INTO order_status_operations (id, order_id, expected_status, requested_status) VALUES (?, ?, ?, ?)`,
        operationId, orderId, parsed.data.expected_status!, nextStatus
      );
      const previous = await tx.queryOne<{ order_id: number; expected_status: string; requested_status: string; result_code: number }>(
        `SELECT order_id, expected_status, requested_status, result_code FROM order_status_operations WHERE id = ?${getDatabaseDriver() === "postgres" ? " FOR UPDATE" : ""}`,
        operationId
      );
      if (!previous || Number(previous.order_id) !== orderId || previous.expected_status !== parsed.data.expected_status || previous.requested_status !== nextStatus) {
        return { code: 400, status: locked.status, error: "معرّف العملية مستخدم لطلب آخر." };
      }
      if (Number(previous.result_code) !== 0) {
        return { code: Number(previous.result_code), status: locked.status, error: "تغيرت حالة الطلب في جلسة أخرى." };
      }
    }
    if (parsed.data.expected_status !== undefined && locked.status !== parsed.data.expected_status) {
      if (operationId) await tx.execute(`UPDATE order_status_operations SET result_code = 409, result_status = ? WHERE id = ?`, locked.status, operationId);
      return { code: 409, status: locked.status, error: "تغيرت حالة الطلب في جلسة أخرى." };
    }
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
    if (operationId) await tx.execute(`UPDATE order_status_operations SET result_code = 200, result_status = ? WHERE id = ?`, nextStatus, operationId);
    return { code: 200, status: nextStatus, error: "" };
  });
  if (result.code !== 200) return NextResponse.json({ error: result.error, status: result.status }, { status: result.code });
  return NextResponse.json({ message: "تم تحديث حالة الطلب بنجاح.", status: result.status });
}

// Only cancelled orders are eligible: their stock has already been restored.
// Database RESTRICT foreign keys protect reward/credit history from deletion.
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi("orders");
  if ("error" in auth) return auth.error;
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "معرّف الطلب غير صالح." }, { status: 400 });
  try {
    const result = await runTransaction(async tx => {
      const order = await tx.queryOne<{ status: string; customer_id: number | null }>(`SELECT status, customer_id FROM orders WHERE id = ?${getDatabaseDriver() === "postgres" ? " FOR UPDATE" : ""}`, id);
      if (!order) return 404;
      if (order.status !== "cancelled") return 409;
      // Checkout updates this same customer row before inserting an order. Lock it
      // first so the aggregate recalculation cannot race a concurrent checkout.
      if (order.customer_id && getDatabaseDriver() === "postgres") {
        await tx.queryOne(`SELECT id FROM customers WHERE id = ? FOR UPDATE`, order.customer_id);
      }
      const deleted = await tx.execute(`DELETE FROM orders WHERE id = ? AND status = ?`, id, "cancelled");
      if (deleted.changes !== 1) return 409;
      if (order.customer_id) {
        await tx.execute(`UPDATE customers SET
          orders_count = (SELECT COUNT(*) FROM orders WHERE customer_id = ?),
          total_spent_iqd = (SELECT COALESCE(SUM(total_iqd), 0) FROM orders WHERE customer_id = ?),
          last_order_at = (SELECT MAX(created_at) FROM orders WHERE customer_id = ?)
          WHERE id = ?`, order.customer_id, order.customer_id, order.customer_id, order.customer_id);
      }
      return 200;
    });
    if (result === 404) return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
    if (result === 409) return NextResponse.json({ error: "يمكن حذف الطلب الملغى فقط." }, { status: 409 });
    return NextResponse.json({ message: "تم حذف الطلب." });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "23503" || code === "23001" || code === "SQLITE_CONSTRAINT_FOREIGNKEY" || (error instanceof Error && error.message.includes("FOREIGN KEY constraint failed"))) {
      return NextResponse.json({ error: "لا يمكن حذف طلب مرتبط بسجل مكافآت أو رصيد." }, { status: 409 });
    }
    return NextResponse.json({ error: "تعذر تأكيد حذف الطلب. تحقق قبل إعادة المحاولة." }, { status: 503 });
  }
}
