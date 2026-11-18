import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  clearCustomerSessionCookies,
  customerAuthClient,
  getCustomerRefreshToken,
  isSameOriginCustomerRequest,
  setCustomerSessionCookies,
} from "@/lib/customer-auth";

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const credentials = z.object({ email, password: z.string().min(8).max(128), name: z.string().trim().max(100).optional() });
const emailOnly = z.object({ email });
const fail = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  if (!isSameOriginCustomerRequest(request)) return fail("الطلب غير مسموح.", 403);
  const { action } = await context.params;
  try {
    if (action === "logout") {
      const refreshToken = await getCustomerRefreshToken();
      if (refreshToken) {
        const client = customerAuthClient();
        const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
        if (error || !data.session) return fail("تعذر إبطال الجلسة، يرجى المحاولة مجددًا.", 503);
        const result = await client.auth.signOut({ scope: "local" });
        if (result.error) return fail("تعذر إبطال الجلسة، يرجى المحاولة مجددًا.", 503);
      }
      // Does not modify the independent admin session.
      const response = NextResponse.json({ message: "تم تسجيل الخروج." }, { headers: { "Cache-Control": "private, no-store" } });
      clearCustomerSessionCookies(response);
      return response;
    }

    const client = customerAuthClient();
    if (action === "refresh") {
      const refreshToken = await getCustomerRefreshToken();
      if (!refreshToken) return fail("يرجى تسجيل الدخول.", 401);
      const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken });
      if (error || !data.session) return fail("تعذر تحديث الجلسة، يرجى تسجيل الدخول مجددًا.", 401);
      const response = NextResponse.json({ message: "تم تحديث الجلسة." }, { headers: { "Cache-Control": "private, no-store" } });
      setCustomerSessionCookies(response, data.session, request);
      return response;
    }

    if (action === "forgot-password") {
      const parsed = emailOnly.safeParse(await request.json());
      if (!parsed.success) return fail("يرجى إدخال بريد إلكتروني صالح.", 400);
      const { error } = await client.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: "https://aura.astore.workers.dev/account/recovery",
      });
      if (error) return fail("تعذر إرسال رابط الاستعادة حاليًا.", 503);
      return NextResponse.json({ message: "إذا كان البريد مسجلًا، ستصل إليه تعليمات استعادة كلمة المرور." }, { headers: { "Cache-Control": "private, no-store" } });
    }

    if (action === "recover-password") {
      const parsed = z.object({ accessToken: z.string().min(1).max(8192), refreshToken: z.string().min(1).max(8192), password: z.string().min(8).max(128) }).safeParse(await request.json());
      if (!parsed.success) return fail("رابط الاستعادة أو كلمة المرور غير صالحين.", 400);
      const { data, error } = await client.auth.setSession({ access_token: parsed.data.accessToken, refresh_token: parsed.data.refreshToken });
      if (error || !data.session) return fail("انتهت صلاحية رابط الاستعادة أو لم يعد صالحًا.", 401);
      const updated = await client.auth.updateUser({ password: parsed.data.password });
      if (updated.error) return fail("تعذر تحديث كلمة المرور.", 400);
      const response = NextResponse.json({ message: "تم تحديث كلمة المرور." }, { headers: { "Cache-Control": "private, no-store" } });
      setCustomerSessionCookies(response, data.session, request);
      return response;
    }

    if (action !== "login" && action !== "register") return fail("العملية غير متوفرة.", 404);
    const parsed = credentials.safeParse(await request.json());
    if (!parsed.success) return fail("يرجى إدخال بريد صالح وكلمة مرور من 8 أحرف على الأقل.", 400);
    if (action === "register") {
      const { data, error } = await client.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { data: { display_name: parsed.data.name || "" } },
      });
      if (error) {
        if (error.code === "user_already_exists" || error.code === "email_exists") return fail("هذا البريد الإلكتروني مستخدم بالفعل.", 409);
        return fail("تعذر إنشاء الحساب حاليًا.", 400);
      }
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return fail("هذا البريد الإلكتروني مستخدم بالفعل.", 409);
      }
      const response = NextResponse.json({ message: data.session ? "تم إنشاء الحساب." : "تحقق من بريدك الإلكتروني لإكمال إنشاء الحساب.", signedIn: Boolean(data.session) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
      if (data.session) setCustomerSessionCookies(response, data.session, request);
      return response;
    }

    const { data, error } = await client.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
    if (error || !data.session) return fail("البريد الإلكتروني أو كلمة المرور غير صحيحة، أو الحساب غير مؤكد.", 401);
    const response = NextResponse.json({ message: "تم تسجيل الدخول." }, { headers: { "Cache-Control": "private, no-store" } });
    setCustomerSessionCookies(response, data.session, request);
    return response;
  } catch {
    return fail("تعذر الاتصال بخدمة حسابات العملاء حاليًا.", 503);
  }
}
