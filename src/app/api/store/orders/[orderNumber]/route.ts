import { NextRequest, NextResponse } from "next/server";
import { queryAll } from "@/db";
import { browserToken, findBrowserOrder, findTrackedOrder } from '@/lib/guest-order-access';

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, context: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await context.params;
  const browser = browserToken(request);
  const order = await findBrowserOrder(orderNumber, browser) || await findTrackedOrder(orderNumber, browser);
  if (!order) return NextResponse.json({ error: "الطلب غير متاح أو بيانات التتبع غير صحيحة." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const items = await queryAll(`SELECT product_name, product_sku, product_image, variant_label, quantity, unit_price_iqd, total_price_iqd FROM order_items WHERE order_id = ? AND CURRENT_TIMESTAMP IS NOT NULL`, order.id);
  return NextResponse.json({ order, items }, { headers: { "Cache-Control": "no-store" } });
}
