import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

// Separate from the administrator's cookie and from the guest cart token.
const ACCESS_COOKIE = "aura_customer_access";
const REFRESH_COOKIE = "aura_customer_refresh";

function envValue(name: string): string {
  try {
    const env = getCloudflareContext().env as Record<string, unknown>;
    const value = env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  } catch {
    // Ordinary Node.js requests do not have a Cloudflare context.
  }
  return process.env[name]?.trim() || "";
}

export function customerAuthClient(): SupabaseClient {
  const url = envValue("SUPABASE_URL") || envValue("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = envValue("SUPABASE_PUBLISHABLE_KEY") || envValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    envValue("SUPABASE_ANON_KEY") || envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !publishableKey) throw new Error("Customer authentication is not configured");
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function isSameOriginCustomerRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export function setCustomerSessionCookies(
  response: NextResponse,
  session: { access_token: string; refresh_token: string; expires_in: number },
  request: NextRequest
): void {
  const secure = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" || request.nextUrl.protocol === "https:";
  const options = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  response.cookies.set(ACCESS_COOKIE, session.access_token, { ...options, maxAge: Math.max(1, Math.min(session.expires_in, 3600)) });
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, { ...options, maxAge: 60 * 60 * 24 * 30 });
}

export function clearCustomerSessionCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

/** Validates the access token against Supabase; never trusts a decoded browser JWT. */
export async function getCustomerUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const { data, error } = await customerAuthClient().auth.getUser(token);
  if (error) {
    if (error.status === 401 || error.status === 403) return null;
    throw new Error("Customer authentication unavailable");
  }
  return data.user;
}

export async function getCustomerRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}
