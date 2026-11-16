import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryOne } from "@/db";
import { createAdminSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

const loginSchema = z.object({
  email: z.string().trim().email("يرجى إدخال بريد إلكتروني صحيح."),
  password: z.string().min(4, "يرجى إدخال كلمة المرور."),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات الدخول غير صالحة." },
        { status: 400 }
      );
    }

    const user = queryOne<{
      id: number;
      name: string;
      email: string;
      password_hash: string;
      is_active: number;
      role_slug: string;
      role_name: string;
      permissions_json: string;
    }>(
      `SELECT u.id, u.name, u.email, u.password_hash, u.is_active,
              r.slug as role_slug, r.name as role_name, r.permissions_json
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE LOWER(u.email) = LOWER(?)`,
      parsed.data.email
    );

    if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
      return NextResponse.json(
        { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." },
        { status: 401 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: "تم تعطيل هذا الحساب. يرجى مراجعة المدير العام." },
        { status: 403 }
      );
    }

    await createAdminSession(user.id);

    return NextResponse.json({
      message: "تم تسجيل الدخول بنجاح.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleSlug: user.role_slug,
        roleName: user.role_name,
        permissions: JSON.parse(user.permissions_json || "[]"),
      },
    });
  } catch (err) {
    console.error("Admin login error:", err);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تسجيل الدخول." },
      { status: 500 }
    );
  }
}
