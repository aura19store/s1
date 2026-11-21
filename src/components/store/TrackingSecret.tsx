"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export function TrackingSecret({ orderNumber, gender }: { orderNumber: string; gender: string }) {
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { try { setSecret(sessionStorage.getItem(`aura-tracking-${orderNumber}`) || ""); } catch { /* Storage may be disabled. */ } }, [orderNumber]);
  return <div className="border border-[#B79B6C]/60 bg-[#F7F4EF] p-5 space-y-3 text-sm">
    <p className="font-semibold">احفظ رقم الطلب ورمز التتبع في مكان آمن</p>
    {secret ? <><p className="text-[#111111]/70">الرمز سري؛ من يملكه مع رقم الطلب يستطيع متابعة الطلب. احتفظ به للانتقال إلى جهاز آخر.</p><p dir="ltr" className="break-all font-mono text-xs select-all">{secret}</p><button type="button" className="min-h-11 underline" onClick={async () => { try { await navigator.clipboard.writeText(`${orderNumber}\n${secret}`); setCopied(true); } catch { setCopied(false); } }}>{copied ? "تم النسخ" : "نسخ بيانات التتبع"}</button></> : <p className="text-[#111111]/70">يمكنك متابعة طلبك من هذا المتصفح. إذا سبق أن حفظت رمز التتبع فاستخدمه على جهاز آخر.</p>}
    <Link href={`/store/${gender}/orders`} className="flex min-h-11 items-center justify-center bg-[#111111] text-[#F7F4EF] px-5 font-semibold">طلباتي</Link>
  </div>;
}
