import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryOne } from "@/db";
import { requireAdminApi } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

const updateUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(6).optional().or(z.literal("")),
  role_id: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("users");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const userId = Number(id);
  const existing = queryOne<{ id: number }>(
    `SELECT id FROM users WHERE id = ?`,
    userId
  );
  if (!existing) {
    return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "بيانات التحديث غير صالحة." },
      { status: 400 }
    );
  }

  const d = parsed.data;
  if (userId === auth.user.id && d.is_active === false) {
    return NextResponse.json(
      { error: "لا يمكنك تعطيل حسابك الشخصي أثناء تسجيل الدخول." },
      { status: 400 }
    );
  }

  const fields: string[] = [];
  const params: (string | number)[] = [];

  if (d.name !== undefined) {
    fields.push("name = ?");
    params.push(d.name);
  }
  if (d.email !== undefined) {
    fields.push("email = ?");
    params.push(d.email);
  }
  if (d.password && d.password.length >= 6) {
    fields.push("password_hash = ?");
    params.push(hashPassword(d.password));
  }
  if (d.role_id !== undefined) {
    fields.push("role_id = ?");
    params.push(d.role_id);
  }
  if (d.is_active !== undefined) {
    fields.push("is_active = ?");
    params.push(d.is_active ? 1 : 0);
  }

  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    execute(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      ...params,
      userId
    );
  }

  return NextResponse.json({ message: "تم تحديث بيانات المستخدم بنجاح." });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("users");
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const userId = Number(id);
  if (userId === auth.user.id) {
    return NextResponse.json(
      { error: "لا يمكنك حذف حسابك الحالي." },
      { status: 400 }
    );
  }

  execute(`DELETE FROM users WHERE id = ?`, userId);
  return NextResponse.json({ message: "تم حذف المستخدم بنجاح." });
}
