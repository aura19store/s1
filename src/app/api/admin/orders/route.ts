import { NextRequest, NextResponse } from "next/server";
import { queryAll } from "@/db";
import { requireAdminApi } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi("orders");
  if ("error" in auth) return auth.error;

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status") || "";
  const search = (sp.get("q") || "").trim();

  const where: string[] = ["1=1"];
  const params: (string | number)[] = [];

  if (status && status !== "all") {
    where.push("o.status = ?");
    params.push(status);
  }
  if (search) {
    const term = `%${search}%`;
    where.push(
      "(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.governorate LIKE ?)"
    );
    params.push(term, term, term, term);
  }

  const orders = await queryAll(
    `SELECT o.*,
            (SELECT SUM(quantity) FROM order_items oi WHERE oi.order_id = o.id) as items_count
     FROM orders o
     WHERE ${where.join(" AND ")}
     ORDER BY datetime(o.created_at) DESC, o.id DESC`,
    ...params
  );

  return NextResponse.json({ orders });
}
