"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, AlertCircle, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذر تسجيل الدخول.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("حدث خطأ في الاتصال بالخادم.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-[#F7F4EF] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#F7F4EF] text-[#111111] border border-[#B79B6C]/40 p-8 sm:p-10 shadow-2xl">
        <div className="text-center space-y-2 pb-7 border-b border-[#D8C8B5]">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#111111] text-[#B79B6C] mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="font-brand text-4xl tracking-[0.28em] text-[#111111]">
            AURA
          </h1>
          <p className="text-xs font-semibold text-[#B79B6C]">
            لوحة إدارة المتجر
          </p>
          <p className="text-xs text-[#111111]/60">
            الدخول مخصص لفريق الإدارة المخوّل فقط
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-semibold text-[#111111] mb-2"
            >
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#111111]/45 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="admin-email"
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="البريد الإداري"
                className="w-full text-right bg-white border border-[#D8C8B5] pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-[#111111] mb-2"
            >
              كلمة المرور
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#111111]/45 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="admin-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full bg-white border border-[#D8C8B5] pr-10 pl-4 py-3 text-sm focus:outline-none focus:border-[#111111]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#111111] text-[#F7F4EF] hover:bg-[#B79B6C] hover:text-[#111111] disabled:opacity-60 text-sm font-semibold transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري التحقق...</span>
              </>
            ) : (
              <span>تسجيل الدخول</span>
            )}
          </button>
        </form>

        <p className="mt-7 pt-5 border-t border-[#D8C8B5]/60 text-center text-[11px] text-[#111111]/55">
          نظام إدارة AURA المحمي • جميع العمليات مشفرة ومسجلة
        </p>
      </div>
    </div>
  );
}
