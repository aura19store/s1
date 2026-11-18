import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabaseDriver, runTransaction } from "@/db";
import { getCustomerUser, isSameOriginCustomerRequest } from "@/lib/customer-auth";
import { eligibleRewardOrders, rewardForCycle, type RewardOption, type RewardOrder } from "@/lib/aura-rewards";

const requestSchema = z.object({ requestKey: z.string().uuid() });
const response = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  if (!isSameOriginCustomerRequest(request)) return response({ error: "الطلب غير مسموح." }, 403);
  // Fail closed until checkout redemption and end-to-end concurrency are complete.
  const redemptionReady: boolean = false;
  if (!redemptionReady) return response({ error: "برنامج المكافآت قيد التجهيز حاليًا." }, 503);
  try {
    const user = await getCustomerUser();
    if (!user || !user.email) return response({ error: "يرجى تسجيل الدخول." }, 401);
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return response({ error: "بيانات الطلب غير صالحة." }, 400);
    const postgres = getDatabaseDriver() === "postgres";
    return await runTransaction(async (tx) => {
      // Serializes claims for this account; SQLite's enclosing BEGIN IMMEDIATE does the same.
      const lock = await tx.execute(`UPDATE customer_accounts SET updated_at = datetime('now') WHERE auth_user_id = ?`, user.id);
      if (!lock.changes) return response({ error: "لا توجد طلبات مؤهلة لهذا الحساب." }, 400);
      const existing = await tx.queryOne<{ id: number; reward_name: string; status: string }>(
        `SELECT id, reward_name, status FROM aura_reward_grants WHERE auth_user_id = ? AND request_key = ?`, user.id, parsed.data.requestKey);
      if (existing) return response({ grant: existing });
      const settings = await tx.queryOne<{ enabled: number; required_orders: number; qualifying_subtotal_iqd: number }>(
        `SELECT enabled, required_orders, qualifying_subtotal_iqd FROM aura_reward_settings WHERE id = 1`);
      if (!settings || Number(settings.enabled) !== 1) return response({ error: "برنامج المكافآت غير مفعّل حاليًا." }, 409);
      const required = Number(settings.required_orders);
      const minimum = Number(settings.qualifying_subtotal_iqd);
      if (!Number.isSafeInteger(required) || required < 1 || !Number.isSafeInteger(minimum) || minimum < 0) {
        throw new Error("Invalid reward settings");
      }
      const orderRows = await tx.queryAll<{ id: number; status: string; subtotal_iqd: number; created_at: string; returned: number; consumed: number }>(
        `SELECT o.id, o.status, o.subtotal_iqd, o.created_at,
          CASE WHEN ex.order_id IS NULL THEN 0 ELSE 1 END AS returned,
          CASE WHEN used.order_id IS NULL AND reset_order.order_id IS NULL THEN 0 ELSE 1 END AS consumed
         FROM customer_account_orders ao JOIN orders o ON o.id = ao.order_id
         LEFT JOIN aura_reward_order_exclusions ex ON ex.order_id = o.id
         LEFT JOIN aura_reward_grant_orders used ON used.order_id = o.id AND used.released_at IS NULL
         LEFT JOIN aura_reward_reset_orders reset_order ON reset_order.order_id = o.id
         WHERE ao.auth_user_id = ? AND o.status = 'delivered'
         ORDER BY o.created_at ASC, o.id ASC${postgres ? " FOR UPDATE OF o" : ""}`, user.id);
      const candidates: RewardOrder[] = orderRows.map((o) => ({ id: Number(o.id), accountId: user.id, status: o.status,
        productsSubtotalAfterDiscountIqd: Number(o.subtotal_iqd), returned: Number(o.returned) === 1, createdAt: o.created_at }));
      const used = new Set(orderRows.filter((o) => Number(o.consumed) === 1).map((o) => Number(o.id)));
      const eligible = eligibleRewardOrders(candidates, user.id, minimum, used);
      if (eligible.length < required) return response({ error: "لم يكتمل عدد الطلبات المؤهلة بعد." }, 409);
      const definitions = await tx.queryAll<{ id: number; name: string; kind: RewardOption["kind"]; credit_iqd: number; stock_quantity: number | null; expiry_days: number | null; sequence_position: number; active: number }>(
        `SELECT id, name, kind, credit_iqd, stock_quantity, expiry_days, sequence_position, active FROM aura_reward_definitions WHERE active = 1 ORDER BY sequence_position, id`);
      const last = await tx.queryOne<{ max_cycle: number | null }>(`SELECT MAX(cycle_number) AS max_cycle FROM aura_reward_grants WHERE auth_user_id = ?`, user.id);
      const cycle = last?.max_cycle == null ? 0 : Number(last.max_cycle) + 1;
      const options = definitions.map((d) => ({ id: Number(d.id), position: Number(d.sequence_position), active: Number(d.active) === 1, kind: d.kind,
        stockQuantity: d.stock_quantity == null ? null : Number(d.stock_quantity) }));
      const selected = rewardForCycle(options, cycle);
      if (!selected) return response({ error: "المكافأة المحددة غير متاحة حاليًا، يرجى المحاولة لاحقًا." }, 409);
      const definition = definitions.find((d) => Number(d.id) === selected.id)!;
      if (selected.kind !== "credit") {
        const update = await tx.execute(`UPDATE aura_reward_definitions SET stock_quantity = stock_quantity - 1 WHERE id = ? AND active = 1 AND stock_quantity > 0`, selected.id);
        if (update.changes !== 1) return response({ error: "نفد مخزون المكافأة المحددة." }, 409);
      }
      const days = definition.expiry_days == null ? null : Number(definition.expiry_days);
      if (days !== null && (!Number.isSafeInteger(days) || days < 1 || days > 36500)) throw new Error("Invalid reward expiry");
      const expiry = days === null ? null : new Date(Date.now() + days * 86400000).toISOString();
      const credit = selected.kind === "credit" ? Number(definition.credit_iqd) : 0;
      const inserted = await tx.execute(
        `INSERT INTO aura_reward_grants (auth_user_id, reward_id, cycle_number, request_key, reward_name, kind, credit_iqd, remaining_iqd, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        user.id, selected.id, cycle, parsed.data.requestKey, definition.name, selected.kind, credit, credit, expiry);
      for (const order of eligible.slice(0, required)) {
        await tx.execute(`INSERT INTO aura_reward_grant_orders (order_id, grant_id) VALUES (?, ?)`, order.id, inserted.lastInsertRowid);
      }
      return response({ grant: { id: inserted.lastInsertRowid, reward_name: definition.name, status: "available" } }, 201);
    });
  } catch {
    return response({ error: "تعذر فتح المكافأة حاليًا." }, 503);
  }
}
