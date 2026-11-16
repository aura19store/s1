import { NextRequest, NextResponse } from "next/server";
import { queryAll, queryOne } from "@/db";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await context.params;
  const order = queryOne<{
    id: number;
    order_number: string;
    customer_name: string;
    governorate: string;
    city: string;
    payment_method: string;
    subtotal_iqd: number;
    discount_iqd: number;
    shipping_iqd: number;
    total_iqd: number;
    status: string;
    created_at: string;
  }>(
    `SELECT id, order_number, customer_name, governorate, city, payment_method,
            subtotal_iqd, discount_iqd, shipping_iqd, total_iqd, status, created_at
     FROM orders WHERE order_number = ?`,
    orderNumber
  );

  if (!order) {
    return NextResponse.json({ error: "الطلب غير موجود." }, { status: 404 });
  }

  const items = queryAll(
    `SELECT product_name, product_sku, product_image, variant_label, quantity, unit_price_iqd, total_price_iqd
     FROM order_items WHERE order_id = ?`,
    order.id
  );

  return NextResponse.json({ order, items });
}
