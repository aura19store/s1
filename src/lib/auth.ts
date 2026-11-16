import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { execute, queryOne } from "@/db";
import { generateToken, hashToken } from "./password";

export const ADMIN_COOKIE_NAME = "aura_admin_session";
export const GUEST_COOKIE_NAME = "aura_guest_session";
const SESSION_DAYS = 7;

async function getSessionCookieOptions(maxAge: number) {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") || "";
  const origin = hdrs.get("origin") || "";
  const isHttps =
    proto.split(",")[0].trim().toLowerCase() === "https" ||
    origin.startsWith("https://");

  return {
    httpOnly: true,
    sameSite: (isHttps ? "none" : "lax") as "none" | "lax",
    secure: isHttps,
    path: "/",
    maxAge,
  };
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  roleId: number;
  roleSlug: string;
  roleName: string;
  permissions: string[];
}

export async function createAdminSession(userId: number): Promise<string> {
  const rawToken = generateToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  execute(
    `INSERT INTO admin_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
    userId,
    tokenHash,
    expiresAt
  );
  execute(
    `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`,
    userId
  );

  const cookieStore = await cookies();
  const cookieOpts = await getSessionCookieOptions(SESSION_DAYS * 24 * 60 * 60);
  cookieStore.set(ADMIN_COOKIE_NAME, rawToken, cookieOpts);

  return rawToken;
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    execute(`DELETE FROM admin_sessions WHERE token_hash = ?`, tokenHash);
  }
  const cookieOpts = await getSessionCookieOptions(0);
  cookieStore.set(ADMIN_COOKIE_NAME, "", cookieOpts);
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const row = queryOne<{
    id: number;
    name: string;
    email: string;
    role_id: number;
    role_slug: string;
    role_name: string;
    permissions_json: string;
    is_active: number;
    expires_at: string;
  }>(
    `SELECT u.id, u.name, u.email, u.role_id, u.is_active,
            r.slug as role_slug, r.name as role_name, r.permissions_json,
            s.expires_at
     FROM admin_sessions s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE s.token_hash = ?`,
    tokenHash
  );

  if (!row || !row.is_active) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    execute(`DELETE FROM admin_sessions WHERE token_hash = ?`, tokenHash);
    return null;
  }

  let permissions: string[] = [];
  try {
    permissions = JSON.parse(row.permissions_json);
  } catch {
    permissions = [];
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    roleId: row.role_id,
    roleSlug: row.role_slug,
    roleName: row.role_name,
    permissions,
  };
}

export function hasPermission(user: AdminUser, permission: string): boolean {
  if (user.roleSlug === "super_admin") return true;
  return user.permissions.includes(permission);
}

export async function requireAdminApi(
  permission?: string
): Promise<{ user: AdminUser } | { error: NextResponse }> {
  const user = await getAdminUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "يرجى تسجيل الدخول للوصول إلى لوحة الإدارة." },
        { status: 401 }
      ),
    };
  }
  if (permission && !hasPermission(user, permission)) {
    return {
      error: NextResponse.json(
        { error: "ليس لديك الصلاحية اللازمة لتنفيذ هذا الإجراء." },
        { status: 403 }
      ),
    };
  }
  return { user };
}

function sanitizeGuestToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^[a-f0-9]{16,128}$/i.test(trimmed)) return trimmed;
  return null;
}

export async function getGuestSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const fromCookie = sanitizeGuestToken(cookieStore.get(GUEST_COOKIE_NAME)?.value);
  if (fromCookie) return fromCookie;

  const hdrs = await headers();
  return sanitizeGuestToken(hdrs.get("x-aura-guest-token"));
}

export async function ensureGuestSessionToken(): Promise<string> {
  const cookieStore = await cookies();
  const hdrs = await headers();
  let token =
    sanitizeGuestToken(cookieStore.get(GUEST_COOKIE_NAME)?.value) ||
    sanitizeGuestToken(hdrs.get("x-aura-guest-token"));
  if (!token) {
    token = generateToken(24);
  }
  const cookieOpts = await getSessionCookieOptions(60 * 60 * 24 * 60); // 60 days
  cookieStore.set(GUEST_COOKIE_NAME, token, cookieOpts);
  return token;
}
