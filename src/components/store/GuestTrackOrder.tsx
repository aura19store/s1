"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildWhatsAppUrl } from "./ContactIcons";
import { AURA_CONTACT } from "@/lib/constants";

export function GuestTrackOrder({ gender }: { gender: string }) {
  const [number, setNumber] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function track(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/store/orders/track", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ orderNumber: number.trim(), secret: secret.trim() }),
      });
      if (!response.ok) { setError("الطلب غير متاح أو بيانات التتبع غير صحيحة."); return; }
      router.push(`/store/${gender}/orders/${encodeURIComponent(number.trim())}`);
    } catch {
      setError("تعذر الاتصال، يرجى المحاولة مجددًا.");
    } finally { setBusy(false); }
  }

  return <main className="max-w-3xl mx-auto px-4 py-10 space-y-6" dir="rtl">
    <div><h1 className="font-editorial text-3xl">تتبع طلب</h1><p className="text-sm mt-2 text-[#111111]/65">أدخل بيانات التتبع التي حفظتها عند إتمام الطلب.</p></div>
    <form onSubmit={track} className="bg-white border border-[#D8C8B5] p-5 sm:p-7 space-y-4">
      <label className="block text-sm">رقم الطلب<input required maxLength={80} value={number} onChange={e => setNumber(e.target.value)} className="block w-full border border-[#D8C8B5] p-3 mt-1" dir="ltr" autoComplete="off" /></label>
      <label className="block text-sm">رمز التتبع<input required maxLength={64} type="password" value={secret} onChange={e => setSecret(e.target.value)} className="block w-full border border-[#D8C8B5] p-3 mt-1" dir="ltr" autoComplete="off" /></label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="min-h-11 w-full sm:w-auto bg-[#111111] text-white px-6 disabled:opacity-50">تتبع الطلب</button>
    </form>
    <section className="border border-[#D8C8B5] bg-[#F7F4EF] p-5 space-y-3 text-sm leading-7">
      <h2 className="font-semibold">طلب قديم أو لا تملك رمز تتبع؟</h2>
      <p>الطلبات السابقة محفوظة لدى إدارة المتجر، لكنها لم تحصل على رموز تتبع. استعادة الوصول إليها غير متاحة مؤقتًا حتى تتوفر طريقة موثوقة للتحقق من الملكية. لا يمكن عرض تفاصيلها برقم الطلب وحده.</p>
      <p>للاستفسار عن الخدمة تواصل مع الدعم. لا ترسل رمز التتبع أو معلومات الدفع، ولن تُكشف تفاصيل الطلب دون تحقق موثوق من الملكية.</p>
      <a href={buildWhatsAppUrl(AURA_CONTACT.whatsappDigits, "مرحبًا، أود الاستفسار عن خدمة تتبع الطلبات السابقة.")} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">التواصل مع الدعم</a>
    </section>
    <Link className="inline-flex min-h-11 items-center underline" href={`/store/${gender}/orders`}>العودة إلى طلباتي</Link>
  </main>;
}
