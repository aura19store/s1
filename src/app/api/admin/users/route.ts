import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryAll, queryOne } from "@/db";
import { requireAdminApi } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function GET() {
  const auth = await requireAdminApi("users");
  if ("error" in auth) return auth.error;

  const [users, roles] = await Promise.all([
    queryAll(`
      SELECT u.id, u.name, u.email, u.role_id, u.is_active, u.last_login_at, u.created_at,
             r.slug as role_slug, r.name as role_name
      FROM users u
      JOIN roles r ON r.id = u.role_id
      ORDER BY u.id ASC
    `),
    queryAll(
      `SELECT id, slug, name, description, permissions_json FROM roles ORDER BY id ASC`
    ),
  ]);

  return NextResponse.json({ users, roles });
}

const createUserSchema = z.object({
  name: z.string().trim().min(2, "يرجى إدخال اسم المستخدم."),
  email: z.string().trim().email("يرجى إدخال بريد إلكتروني صحيح."),
  password: z
    .string()
    .min(6, "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل."),
  role_id: z.number().int().positive("يرجى اختيار مستوى الصلاحية."),
  is_active: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("users");
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "بيانات المستخدم غير صالحة." },
      { status: 400 }
    );
  }

  const dup = await queryOne<{ id: number }>(
    `SELECT id FROM users WHERE LOWER(email) = LOWER(?)`,
    parsed.data.email
  );
  if (dup) {
    return NextResponse.json(
      { error: "البريد الإلكتروني مسجل مسبقًا لمستخدم آخر." },
      { status: 400 }
    );
  }

  const pwHash = hashPassword(parsed.data.password);
  const res = await execute(
    `INSERT INTO users (name, email, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, ?)`,
    parsed.data.name,
    parsed.data.email,
    pwHash,
    parsed.data.role_id,
    parsed.data.is_active ? 1 : 0
  );

  return NextResponse.json(
    { id: res.lastInsertRowid, message: "تمت إضافة المستخدم بنجاح." },
    { status: 201 }
  );
}
