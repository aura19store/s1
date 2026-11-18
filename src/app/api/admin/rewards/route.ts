import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryAll, queryOne, runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";
import { isSameOriginCustomerRequest } from "@/lib/customer-auth";
import { eligibleRewardOrders, rewardProgress, type RewardOrder } from "@/lib/aura-rewards";

const reward = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["credit", "necklace", "bracelet", "watch", "wallet", "bag"]),
  creditIqd: z.number().int().min(0).max(100000000),
  stockQuantity: z.number().int().min(0).max(1000000).nullable(),
  lowStockThreshold: z.number().int().min(0).max(1000000),
  expiryDays: z.number().int().min(1).max(36500).nullable(),
  sequencePosition: z.number().int().min(0).max(1000000),
  active: z.boolean(),
}).refine((r) => r.kind === "credit" ? r.creditIqd > 0 && r.stockQuantity === null : r.creditIqd === 0 && r.stockQuantity !== null);
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), enabled: z.boolean(), minimumIqd: z.number().int().min(0).max(100000000), requiredOrders: z.number().int().min(1).max(1000) }),
  z.object({ action: z.literal("create"), reward }),
  z.object({ action: z.literal("update"), id: z.number().int().positive(), reward }),
  z.object({ action: z.literal("delete"), id: z.number().int().positive() }),
  z.object({ action: z.literal("reset"), accountId: z.string().uuid() }),
  z.object({ action: z.literal("revoke"), id: z.number().int().positive() }),
  z.object({ action: z.literal("fulfill"), id: z.number().int().positive() }),
]);
const reply = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  const auth = await requireAdminApi("customers");
  if ("error" in auth) return auth.error;
  try {
    const [settings, definitions, grants, accounts, rows] = await Promise.all([
      queryOne<{ enabled: number; qualifying_subtotal_iqd: number; required_orders: number }>(`SELECT * FROM aura_reward_settings WHERE id = 1`),
      queryAll(`SELECT * FROM aura_reward_definitions ORDER BY sequence_position, id`),
      queryAll(`SELECT g.id, g.reward_name, g.kind, g.credit_iqd, g.remaining_iqd, g.status, g.granted_at, g.expires_at, a.email FROM aura_reward_grants g JOIN customer_accounts a ON a.auth_user_id = g.auth_user_id ORDER BY g.granted_at DESC, g.id DESC`),
      queryAll<{ auth_user_id: string; email: string; display_name: string }>(`SELECT auth_user_id, email, display_name FROM customer_accounts ORDER BY created_at DESC`),
      queryAll<{ auth_user_id: string; id: number; status: string; subtotal_iqd: number; created_at: string; returned: number; consumed: number }>(
        `SELECT ao.auth_user_id, o.id, o.status, o.subtotal_iqd, o.created_at,
         CASE WHEN ex.order_id IS NULL THEN 0 ELSE 1 END AS returned,
         CASE WHEN used.order_id IS NULL AND reset_order.order_id IS NULL THEN 0 ELSE 1 END AS consumed
         FROM customer_account_orders ao JOIN orders o ON o.id = ao.order_id
         LEFT JOIN aura_reward_order_exclusions ex ON ex.order_id = o.id
         LEFT JOIN aura_reward_grant_orders used ON used.order_id = o.id AND used.released_at IS NULL
         LEFT JOIN aura_reward_reset_orders reset_order ON reset_order.order_id = o.id`),
    ]);
    const minimum = Number(settings?.qualifying_subtotal_iqd ?? 15000), required = Number(settings?.required_orders ?? 5);
    const progress = accounts.map((account) => {
      const accountRows = rows.filter((row) => row.auth_user_id === account.auth_user_id);
      const orders: RewardOrder[] = accountRows.map((row) => ({ id: Number(row.id), accountId: row.auth_user_id, status: row.status,
        productsSubtotalAfterDiscountIqd: Number(row.subtotal_iqd), returned: Number(row.returned) === 1, createdAt: row.created_at }));
      const used = new Set(accountRows.filter((row) => Number(row.consumed) === 1).map((row) => Number(row.id)));
      return { ...account, ...rewardProgress(eligibleRewardOrders(orders, account.auth_user_id, minimum, used), required) };
    });
    return reply({ settings: settings || { enabled: 0, qualifying_subtotal_iqd: 15000, required_orders: 5 }, definitions, grants, progress });
  } catch { return reply({ error: "تعذر تحميل إدارة المكافآت. تحقق من تطبيق التهيئة المطلوبة." }, 503); }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("customers");
  if ("error" in auth) return auth.error;
  if (!isSameOriginCustomerRequest(request)) return reply({ error: "الطلب غير مسموح." }, 403);
  try {
    const parsed = action.safeParse(await request.json());
    if (!parsed.success) return reply({ error: "بيانات المكافأة غير صالحة." }, 400);
    const d = parsed.data;
    // Redemption and recovery are not yet complete. Do not permit activation of a partial program.
    if (d.action === "settings" && d.enabled) return reply({ error: "لا يمكن تفعيل البرنامج قبل استكمال صرف الرصيد واختبارات التكامل." }, 409);
    return await runTransaction(async (tx) => {
      if (d.action === "settings") {
        await tx.execute(`INSERT INTO aura_reward_settings (id, enabled, qualifying_subtotal_iqd, required_orders) VALUES (1, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET enabled = excluded.enabled, qualifying_subtotal_iqd = excluded.qualifying_subtotal_iqd, required_orders = excluded.required_orders, updated_at = datetime('now')`, Number(d.enabled), d.minimumIqd, d.requiredOrders);
      } else if (d.action === "create" || d.action === "update") {
        const r = d.reward;
        if (d.action === "create") await tx.execute(`INSERT INTO aura_reward_definitions (name, kind, credit_iqd, stock_quantity, low_stock_threshold, expiry_days, sequence_position, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, r.name, r.kind, r.creditIqd, r.stockQuantity, r.lowStockThreshold, r.expiryDays, r.sequencePosition, Number(r.active));
        else {
          const result = await tx.execute(`UPDATE aura_reward_definitions SET name = ?, kind = ?, credit_iqd = ?, stock_quantity = ?, low_stock_threshold = ?, expiry_days = ?, sequence_position = ?, active = ?, updated_at = datetime('now') WHERE id = ?`, r.name, r.kind, r.creditIqd, r.stockQuantity, r.lowStockThreshold, r.expiryDays, r.sequencePosition, Number(r.active), d.id);
          if (!result.changes) return reply({ error: "المكافأة غير موجودة." }, 404);
        }
      } else if (d.action === "delete") {
        const result = await tx.execute(`DELETE FROM aura_reward_definitions WHERE id = ? AND NOT EXISTS (SELECT 1 FROM aura_reward_grants WHERE reward_id = ?)`, d.id, d.id);
        if (!result.changes) return reply({ error: "تعذر الحذف: المكافأة غير موجودة أو مرتبطة بسجل." }, 409);
      } else if (d.action === "reset") {
        const locked = await tx.execute(`UPDATE customer_accounts SET updated_at = datetime('now') WHERE auth_user_id = ?`, d.accountId);
        if (!locked.changes) return reply({ error: "الحساب غير موجود." }, 404);
        const orders = await tx.queryAll<{ order_id: number }>(`SELECT order_id FROM customer_account_orders WHERE auth_user_id = ?`, d.accountId);
        for (const item of orders) await tx.execute(`INSERT OR IGNORE INTO aura_reward_reset_orders (order_id, auth_user_id) VALUES (?, ?)`, item.order_id, d.accountId);
      } else if (d.action === "fulfill") {
        const result = await tx.execute(`UPDATE aura_reward_grants SET status = 'used', used_at = datetime('now') WHERE id = ? AND kind <> 'credit' AND status = 'available' AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`, d.id);
        if (!result.changes) return reply({ error: "لا يمكن تسجيل تسليم هذه المكافأة." }, 409);
      } else if (d.action === "revoke") {
        const grant = await tx.queryOne<{ id: number; reward_id: number; kind: string }>(`SELECT id, reward_id, kind FROM aura_reward_grants WHERE id = ?`, d.id);
        if (!grant) return reply({ error: "المكافأة غير موجودة." }, 404);
        const result = await tx.execute(`UPDATE aura_reward_grants SET status = 'revoked', revoked_at = datetime('now') WHERE id = ? AND status IN ('available', 'expired') AND (kind <> 'credit' OR remaining_iqd = credit_iqd)`, d.id);
        if (!result.changes) return reply({ error: "لا يمكن إبطال مكافأة مستخدمة أو غير متاحة." }, 409);
        if (grant.kind !== "credit") await tx.execute(`UPDATE aura_reward_definitions SET stock_quantity = stock_quantity + 1 WHERE id = ?`, grant.reward_id);
        await tx.execute(`UPDATE aura_reward_grant_orders SET released_at = datetime('now') WHERE grant_id = ? AND released_at IS NULL`, grant.id);
      }
      return reply({ message: "تم حفظ التغييرات." });
    });
  } catch { return reply({ error: "تعذر حفظ تغييرات المكافآت." }, 503); }
}
