import { NextRequest, NextResponse } from "next/server";
import { queryAll } from "@/db";
import { requireAdminApi } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi("customers");
  if ("error" in auth) return auth.error;

  const search = (request.nextUrl.searchParams.get("q") || "").trim();
  const where = search
    ? "WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?"
    : "";
  const term = `%${search}%`;
  const params = search ? [term, term, term] : [];

  const customers = queryAll(
    `SELECT id, name, phone, email, orders_count, total_spent_iqd, last_order_at
     FROM customers
     ${where}
     ORDER BY datetime(last_order_at) DESC, id DESC`,
    ...params
  );

  return NextResponse.json({ customers });
}
