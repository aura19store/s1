"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { formatIQD } from "@/lib/format";

interface AccountData {
  profile: { email: string; name: string };
  orders: { id: number; order_number: string; status: string; subtotal_iqd: number; total_iqd: number; created_at: string }[];
  rewards: { enabled: boolean; completed: number; required: number; remaining: number; ready: boolean; grants: { id: number; reward_name: string; status: string; granted_at: string; expires_at: string | null; used_at: string | null; kind: string; remaining_iqd: number }[] };
}
const statusLabels: Record<string, string> = { pending: "قيد الانتظار", confirmed: "تم التأكيد", processing: "قيد التجهيز", shipped: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغى" };
const rewardLabels: Record<string, string> = { available: "متاحة", used: "مستخدمة", revoked: "مُبطلة", expired: "منتهية" };

export function CustomerAccount() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"login" | "register" | "forgot-password">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const claimKey = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      let res = await fetch("/api/store/customer/me", { cache: "no-store" });
      if (res.status === 401) {
        const refresh = await fetch("/api/store/customer/auth/refresh", { method: "POST" });
        if (refresh.ok) res = await fetch("/api/store/customer/me", { cache: "no-store" });
      }
      if (res.ok) setData(await res.json());
      else if (res.status === 401) setData(null);
      else setMessage("تعذر تحميل الحساب حاليًا.");
    } catch {
      setMessage("تعذر الاتصال بخدمة الحساب.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/store/customer/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const json = await res.json();
      setMessage(res.ok ? json.message : json.error || "تعذر إكمال العملية.");
      if (res.ok && (mode === "login" || json.signedIn)) { setPassword(""); await load(); }
    } catch { setMessage("تعذر الاتصال بخدمة الحساب."); }
    finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try {
      const res = await fetch("/api/store/customer/auth/logout", { method: "POST" });
      if (res.ok) { setData(null); setMessage("تم تسجيل الخروج."); }
      else setMessage("تعذر تسجيل الخروج.");
    } catch { setMessage("تعذر الاتصال بخدمة الحساب."); }
    finally { setBusy(false); }
  }

  async function claimReward() {
    if (busy) return;
    setBusy(true); setMessage("");
    const storageKey = `aura-reward-claim:${data?.profile.email || ""}`;
    const requestKey = claimKey.current || sessionStorage.getItem(storageKey) || crypto.randomUUID();
    claimKey.current = requestKey;
    sessionStorage.setItem(storageKey, requestKey);
    try {
      const res = await fetch("/api/store/customer/rewards/claim", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestKey }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage(`مبروك! مكافأتك: ${json.grant.reward_name} ✨`);
        await load();
        claimKey.current = null;
        sessionStorage.removeItem(storageKey);
      } else setMessage(json.error || "تعذر فتح المكافأة.");
    } catch { setMessage("تعذر الاتصال بخدمة المكافآت. يمكنك إعادة المحاولة."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="mx-auto max-w-5xl px-6 py-20 text-sm">جاري تحميل الحساب...</div>;
  if (!data) return <div className="mx-auto max-w-md px-6 py-16" dir="rtl">
    <h1 className="font-editorial text-3xl mb-3">حسابي</h1>
    <p className="text-sm text-[#111111]/65 mb-7">سجّل الدخول لمتابعة طلباتك ومكافآت AURA.</p>
    <form onSubmit={submit} className="space-y-4 bg-white p-6 border border-[#D8C8B5]">
      {mode === "register" && <label className="block text-sm">الاسم (اختياري)<input value={name} onChange={e => setName(e.target.value)} maxLength={100} className="mt-2 w-full border border-[#D8C8B5] p-3" /></label>}
      <label className="block text-sm">البريد الإلكتروني<input required type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="mt-2 w-full border border-[#D8C8B5] p-3" /></label>
      {mode !== "forgot-password" && <label className="block text-sm">كلمة المرور<input required type="password" minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} className="mt-2 w-full border border-[#D8C8B5] p-3" /></label>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <button disabled={busy} className="w-full bg-[#111111] text-[#F7F4EF] p-3 text-sm disabled:opacity-50">{mode === "login" ? "تسجيل الدخول" : mode === "register" ? "إنشاء حساب" : "إرسال رابط الاستعادة"}</button>
      <div className="flex flex-wrap gap-4 text-xs underline">
        <button type="button" onClick={() => { setMode(mode === "register" ? "login" : "register"); setMessage(""); }}>{mode === "register" ? "لدي حساب" : "إنشاء حساب"}</button>
        <button type="button" onClick={() => { setMode(mode === "forgot-password" ? "login" : "forgot-password"); setMessage(""); }}>{mode === "forgot-password" ? "العودة لتسجيل الدخول" : "نسيت كلمة المرور؟"}</button>
      </div>
    </form>
  </div>;
  return <div className="mx-auto max-w-5xl px-6 py-16 space-y-8" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-editorial text-3xl">حسابي</h1><p className="text-sm text-[#111111]/65 mt-2">{data.profile.name || "أهلًا بك"} · {data.profile.email}</p></div><button onClick={logout} disabled={busy} className="border border-[#111111] px-5 py-2 text-sm">تسجيل الخروج</button></div>
    {message && <p role="status" className="text-sm">{message}</p>}
    <section className="bg-white border border-[#D8C8B5] p-6"><h2 className="font-editorial text-2xl">مكافآت AURA ✨</h2><p className="text-sm text-[#111111]/65 mt-2">كل طلب مؤهل يقربك من مكافأتك القادمة.</p>
      {data.rewards.enabled ? <div className="mt-6"><p className="text-sm">تقدمك نحو المكافأة: {data.rewards.completed} / {data.rewards.required} طلبات مؤهلة</p><div className="mt-3 h-2 bg-[#EFEAE2]"><div className="h-full bg-[#B79B6C] transition-all" style={{ width: `${(data.rewards.completed / data.rewards.required) * 100}%` }} /></div><p className="mt-3 text-sm">{data.rewards.ready ? "مبروك! مكافأتك أصبحت جاهزة ✨" : data.rewards.remaining === 2 ? "باقي طلبان وتفتح مكافأتك 🎁" : `باقي ${data.rewards.remaining} طلبات مؤهلة.`}</p>{data.rewards.ready && <button type="button" disabled={busy} onClick={() => void claimReward()} className="mt-4 bg-[#111111] text-[#F7F4EF] px-5 py-3 text-sm disabled:opacity-50">افتح مكافأتك 🎁</button>}</div> : <p className="mt-4 text-sm text-[#111111]/65">برنامج المكافآت غير مفعّل حاليًا.</p>}
    </section>
    <section className="bg-white border border-[#D8C8B5] p-6"><h2 className="font-editorial text-2xl mb-4">مكافآتي</h2>{data.rewards.grants.length === 0 ? <p className="text-sm text-[#111111]/65">لا توجد مكافآت بعد.</p> : <ul className="space-y-3">{data.rewards.grants.map(g => <li key={g.id} className="border-b border-[#D8C8B5]/50 pb-3 text-sm"><strong>{g.reward_name}</strong> · {g.status === "available" && g.expires_at && new Date(g.expires_at).getTime() <= Date.now() ? "منتهية" : rewardLabels[g.status] || g.status}{g.kind === "credit" ? ` · الرصيد المتبقي: ${formatIQD(Number(g.remaining_iqd))}` : ""}<p className="text-xs mt-1">تاريخ المنح: {new Date(g.granted_at).toLocaleDateString("ar-IQ")}{g.expires_at ? ` · تنتهي: ${new Date(g.expires_at).toLocaleDateString("ar-IQ")}` : ""}{g.used_at ? ` · آخر استخدام: ${new Date(g.used_at).toLocaleDateString("ar-IQ")}` : ""}</p></li>)}</ul>}</section>
    <section className="bg-white border border-[#D8C8B5] p-6"><h2 className="font-editorial text-2xl mb-4">طلباتي</h2>{data.orders.length === 0 ? <p className="text-sm text-[#111111]/65">لا توجد طلبات مرتبطة بهذا الحساب بعد.</p> : <ul className="space-y-3">{data.orders.map(o => <li key={o.id} className="flex flex-wrap justify-between gap-2 border-b border-[#D8C8B5]/50 pb-3 text-sm"><span>{o.order_number} · {statusLabels[o.status] || o.status}</span><span>{formatIQD(Number(o.total_iqd))}</span></li>)}</ul>}</section>
  </div>;
}
