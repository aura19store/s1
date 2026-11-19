import { NextRequest, NextResponse } from "next/server";
import { browserToken, listBrowserOrders } from "@/lib/guest-order-access";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const orders = await listBrowserOrders(browserToken(request));
  return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}
