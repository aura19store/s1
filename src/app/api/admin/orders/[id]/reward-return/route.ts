import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabaseDriver, runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";
import { recordCreditReview } from "@/lib/reward-credit-review";
import { isSameOriginCustomerRequest } from "@/lib/customer-auth";

// This exclusion changes reward eligibility only; it does not refund, change order
// status, or affect inventory. Reinstating eligibility requires a separate review.
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi("orders");
  if ("error" in auth) return auth.error;
  if (!isSameOriginCustomerRequest(request)) return NextResponse.json({ error: "الطلب غير مسموح." }, { status: 403 });
  const parsed = z.coerce.number().int().positive().safeParse((await context.params).id);
  if (!parsed.success) return NextResponse.json({ error: "رقم الطلب غير صالح." }, { status: 400 });
  try {
    return await runTransaction(async tx => {
      const order = await tx.queryOne<{ id: number }>(`SELECT id FROM orders WHERE id = ?${getDatabaseDriver() === "postgres" ? " FOR UPDATE" : ""}`, parsed.data);
      if (!order) return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
      await recordCreditReview(tx, parsed.data, "returned", getDatabaseDriver());
      await tx.execute(`INSERT OR IGNORE INTO aura_reward_order_exclusions (order_id, reason) VALUES (?, 'returned')`, parsed.data);
      const grant = await tx.queryOne<{ id: number; reward_id: number; kind: string }>(`SELECT g.id, g.reward_id, g.kind FROM aura_reward_grants g JOIN aura_reward_grant_orders go ON go.grant_id = g.id WHERE go.order_id = ? AND go.released_at IS NULL`, parsed.data);
      if (grant) {
        const revoked = await tx.execute(`UPDATE aura_reward_grants SET status = 'revoked', revoked_at = datetime('now') WHERE id = ? AND status IN ('available', 'expired') AND (kind <> 'credit' OR remaining_iqd = credit_iqd)`, grant.id);
        if (revoked.changes) {
          if (grant.kind !== "credit") await tx.execute(`UPDATE aura_reward_definitions SET stock_quantity = stock_quantity + 1 WHERE id = ?`, grant.reward_id);
          await tx.execute(`UPDATE aura_reward_grant_orders SET released_at = datetime('now') WHERE grant_id = ? AND released_at IS NULL`, grant.id);
        } else await tx.execute(`INSERT OR IGNORE INTO aura_reward_incidents (order_id, grant_id, reason) VALUES (?, ?, ?)`, parsed.data, grant.id, "returned_after_reward_use");
      }
      return NextResponse.json({ message: "تم استثناء الطلب من المكافآت. لم تتغير حالة الطلب أو عملية الدفع." });
    });
  } catch { return NextResponse.json({ error: "تعذر استثناء الطلب. تحقق من تطبيق تهيئة المكافآت." }, { status: 503 }); }
}
