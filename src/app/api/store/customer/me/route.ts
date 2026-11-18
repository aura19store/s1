import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/db";
import { getCustomerUser } from "@/lib/customer-auth";
import { eligibleRewardOrders, rewardProgress, type RewardOrder } from "@/lib/aura-rewards";

export async function GET() {
  try {
    const user = await getCustomerUser();
    if (!user || !user.email) return NextResponse.json({ error: "يرجى تسجيل الدخول." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    const [orders, settings, grants] = await Promise.all([
      queryAll<{ id: number; order_number: string; status: string; subtotal_iqd: number; total_iqd: number; created_at: string; returned: number; consumed: number }>(
        `SELECT o.id, o.order_number, o.status, o.subtotal_iqd, o.total_iqd, o.created_at,
          CASE WHEN ex.order_id IS NULL THEN 0 ELSE 1 END AS returned,
          CASE WHEN used.order_id IS NULL AND reset_order.order_id IS NULL THEN 0 ELSE 1 END AS consumed
         FROM customer_account_orders ao
         JOIN orders o ON o.id = ao.order_id
         LEFT JOIN aura_reward_order_exclusions ex ON ex.order_id = o.id
         LEFT JOIN aura_reward_grant_orders used ON used.order_id = o.id AND used.released_at IS NULL
         LEFT JOIN aura_reward_reset_orders reset_order ON reset_order.order_id = o.id
         WHERE ao.auth_user_id = ? ORDER BY o.created_at DESC, o.id DESC`, user.id),
      queryOne<{ enabled: number; qualifying_subtotal_iqd: number; required_orders: number }>(
        `SELECT enabled, qualifying_subtotal_iqd, required_orders FROM aura_reward_settings WHERE id = 1`),
      queryAll<{ id: number; reward_name: string; kind: string; credit_iqd: number; remaining_iqd: number; status: string; granted_at: string; expires_at: string | null; used_at: string | null }>(
        `SELECT id, reward_name, kind, credit_iqd, remaining_iqd, status, granted_at, expires_at, used_at
         FROM aura_reward_grants WHERE auth_user_id = ? ORDER BY granted_at DESC, id DESC`, user.id),
    ]);
    const minimum = Number(settings?.qualifying_subtotal_iqd ?? 15000);
    const required = Number(settings?.required_orders ?? 5);
    const rows: RewardOrder[] = orders.map((item) => ({
      id: Number(item.id), accountId: user.id, status: item.status,
      productsSubtotalAfterDiscountIqd: Number(item.subtotal_iqd),
      returned: Number(item.returned) === 1, createdAt: item.created_at,
    }));
    const used = new Set(orders.filter((item) => Number(item.consumed) === 1).map((item) => Number(item.id)));
    const progress = rewardProgress(eligibleRewardOrders(rows, user.id, minimum, used), required);
    return NextResponse.json({
      profile: { email: user.email, name: typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "" },
      orders: orders.map(({ returned, consumed, ...item }) => item),
      rewards: { enabled: Number(settings?.enabled ?? 0) === 1, minimumIqd: minimum, ...progress, grants },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "تعذر تحميل الحساب حاليًا." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
