import { NextRequest, NextResponse } from "next/server";
import { getDatabaseDriver, runTransaction } from "@/db";
import { hashToken } from "@/lib/password";
import { browserTokenOrNew, setBrowserToken, validSecret } from "@/lib/guest-order-access";
import { isSameOriginCustomerRequest } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginCustomerRequest(request)) {
    return NextResponse.json({ error: "الطلب غير مسموح." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: "بيانات التتبع غير صالحة." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  if (!input || typeof input !== "object") {
    return NextResponse.json({ error: "بيانات التتبع غير صالحة." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const { orderNumber, secret } = input as Record<string, unknown>;
  const number = typeof orderNumber === "string" ? orderNumber.trim() : "";
  const code = typeof secret === "string" ? secret.trim() : "";

  if (!number || number.length > 80 || !validSecret(code)) {
    return NextResponse.json({ error: "الطلب غير متاح أو بيانات التتبع غير صحيحة." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const browser = browserTokenOrNew(request);
  const browserHash = hashToken(browser);
  const secretHash = hashToken(code);
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const tracked = await runTransaction(async tx => {
    const order = await tx.queryOne<{ id: number }>(
      `SELECT o.id
       FROM orders o
       JOIN guest_order_credentials c ON c.order_id = o.id
       WHERE o.order_number = ?
         AND c.secret_hash = ?
         AND CURRENT_TIMESTAMP IS NOT NULL
         ${getDatabaseDriver() === "postgres" ? "FOR UPDATE OF o" : ""}`,
      number,
      secretHash
    );

    if (!order) return false;

    await tx.execute(
      `INSERT INTO guest_order_tracking_sessions (order_id, browser_hash, expires_at)
       VALUES (?, ?, ?)
       ON CONFLICT (order_id, browser_hash)
       DO UPDATE SET expires_at = ?`,
      order.id,
      browserHash
    );

    return true;
  });

  if (!tracked) {
    return NextResponse.json({ error: "الطلب غير متاح أو بيانات التتبع غير صحيحة." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  setBrowserToken(response, request, browser);
  return response;
}
