import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryAll, queryOne, runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("orders");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const orderId = Number(id);
  const order = queryOne(`SELECT * FROM orders WHERE id = ?`, orderId);
  if (!order) {
    return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
  }

  const items = queryAll(
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
  const existing = queryOne<{ id: number; status: string }>(
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

  runTransaction((db) => {
    // If transitioning to cancelled from a non-cancelled state, restore product stock
    if (nextStatus === "cancelled" && existing.status !== "cancelled") {
      const items = db
        .prepare(
          `SELECT product_id, quantity FROM order_items WHERE order_id = ? AND product_id IS NOT NULL`
        )
        .all(orderId) as { product_id: number; quantity: number }[];
      const restore = db.prepare(
        `UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?`
      );
      for (const it of items) {
        restore.run(it.quantity, it.product_id);
      }
    }

    const paymentStatus =
      nextStatus === "delivered"
        ? "paid"
        : nextStatus === "cancelled"
        ? "cancelled"
        : "pending";

    db.prepare(
      `UPDATE orders SET status = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(nextStatus, paymentStatus, orderId);
  });

  return NextResponse.json({ message: "تم تحديث حالة الطلب بنجاح." });
}
