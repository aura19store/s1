import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminUser } from "@/lib/auth";
import { execute, queryOne } from "@/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function GET() {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "يرجى إدخال اسم المدير.").optional(),
  email: z.string().trim().email("يرجى إدخال بريد إلكتروني صحيح.").optional(),
  password: z.string().min(6, "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.").optional(),
  current_password: z.string().optional(),
}).strict();

export async function PATCH(request: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "يرجى تسجيل الدخول." }, { status: 401 });
  // Only same-origin browser requests with JSON may change account credentials.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    if (!origin || !host || new URL(origin).host !== host || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return NextResponse.json({ error: "طلب غير مسموح." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "طلب غير مسموح." }, { status: 403 });
  }
  let input: unknown;
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: "بيانات الطلب غير صالحة." }, { status: 400 });
  }
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "بيانات غير صالحة." }, { status: 400 });
  const data = parsed.data;
  let expected: string | undefined;
  if (data.password) {
    const row = await queryOne<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = ?`, user.id);
    if (!row || !data.current_password || !verifyPassword(data.current_password, row.password_hash)) {
      return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة." }, { status: 400 });
    }
    expected = row.password_hash;
  }
  if (data.email) {
    const existing = await queryOne<{ id: number }>(`SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ?`, data.email, user.id);
    if (existing) return NextResponse.json({ error: "البريد الإلكتروني مسجل لمستخدم آخر." }, { status: 400 });
  }
  const fields: string[] = [];
  const args: (string | number)[] = [];
  if (data.name !== undefined) { fields.push("name = ?"); args.push(data.name); }
  if (data.email !== undefined) { fields.push("email = ?"); args.push(data.email); }
  if (data.password) { fields.push("password_hash = ?"); args.push(hashPassword(data.password)); }
  if (fields.length) {
    fields.push("updated_at = datetime('now')");
    const result = await execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?${expected ? " AND password_hash = ?" : ""}`, ...args, user.id, ...(expected ? [expected] : []));
    if (result.changes !== 1) return NextResponse.json({ error: "تغير الحساب أثناء الحفظ، يرجى المحاولة مجددًا." }, { status: 409 });
  }
  return NextResponse.json({ message: "تم حفظ معلومات المدير بنجاح.", user: { id: user.id, name: data.name ?? user.name, email: data.email ?? user.email } });
}
