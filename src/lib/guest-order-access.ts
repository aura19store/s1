import { NextRequest, NextResponse } from "next/server";
import { queryAll, queryOne, type DbClient } from "@/db";
import { generateToken, hashToken } from "@/lib/password";

const SECURE_COOKIE = "__Host-aura_order_browser";
const LOCAL_COOKIE = "aura_order_browser";
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

// __Host- cookies cannot be supplied by a sibling subdomain. The non-Secure
// name is only accepted on a loopback development host.
export function isLocalOrderHost(host: string) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
}
export function readOrderBrowserCookie(get: (name: string) => string | undefined, host: string) {
  const token = get(isLocalOrderHost(host) ? LOCAL_COOKIE : SECURE_COOKIE) || "";
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function newOrderSecret() { return generateToken(32); }
export function browserToken(request: NextRequest) {
  return readOrderBrowserCookie(name => request.cookies.get(name)?.value, request.headers.get("host") || "");
}
export function browserTokenOrNew(request: NextRequest) { return browserToken(request) || generateToken(32); }
export function setBrowserToken(response: NextResponse, request: NextRequest, token: string) {
  const local = isLocalOrderHost(request.headers.get("host") || "");
  response.cookies.set(local ? LOCAL_COOKIE : SECURE_COOKIE, token, { httpOnly: true, secure: !local, sameSite: "lax", path: "/", maxAge: 2 * 365 * 86400 });
}
export async function addOrderAccess(tx: DbClient, orderId: number, browser: string, secret: string) {
  await tx.execute("INSERT INTO guest_order_credentials (order_id, secret_hash) VALUES (?, ?)", orderId, hashToken(secret));
  await tx.execute("INSERT INTO guest_order_access (order_id, browser_hash) VALUES (?, ?)", orderId, hashToken(browser));
}
export function validSecret(secret: string) { return TOKEN_PATTERN.test(secret); }
export async function findBrowserOrder(number: string, browser: string | null) {
  if (!browser || number.length > 80) return null;
  return queryOne<{ id: number; order_number: string; customer_name: string; governorate: string; city: string; payment_method: string; subtotal_iqd: number; discount_iqd: number; shipping_iqd: number; total_iqd: number; status: string; created_at: string }>(
    `SELECT o.id, o.order_number, o.customer_name, o.governorate, o.city, o.payment_method, o.subtotal_iqd, o.discount_iqd, o.shipping_iqd, o.total_iqd, o.status, o.created_at
     FROM orders o JOIN guest_order_access a ON a.order_id = o.id WHERE o.order_number = ? AND a.browser_hash = ? AND CURRENT_TIMESTAMP IS NOT NULL`, number, hashToken(browser));
}
export async function listBrowserOrders(browser: string | null) {
  if (!browser) return [];
  return queryAll<{order_number: string; status: string; total_iqd: number; created_at: string}>(
    `SELECT o.order_number, o.status, o.total_iqd, o.created_at FROM orders o JOIN guest_order_access a ON a.order_id = o.id
     WHERE a.browser_hash = ? AND CURRENT_TIMESTAMP IS NOT NULL ORDER BY o.created_at DESC, o.id DESC`, hashToken(browser));
}
