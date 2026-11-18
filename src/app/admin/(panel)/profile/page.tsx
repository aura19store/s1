"use client";

import React, { useEffect, useRef, useState } from "react";

export default function AdminProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let live = true;
    fetch("/api/admin/auth/me", { cache: "no-store" }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر تحميل المعلومات.");
      if (live) { setName(data.user.name); setEmail(data.user.email); }
    }).catch(() => { if (live) setError("تعذر تحميل معلومات المدير."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current) return;
    setError(""); setMessage("");
    if (password && password !== confirm) { setError("تأكيد كلمة المرور غير مطابق."); return; }
    if (password && !current) { setError("يرجى إدخال كلمة المرور الحالية."); return; }
    pending.current = true; setSaving(true);
    try {
      const res = await fetch("/api/admin/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, ...(password ? { password, current_password: current } : {}) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "تعذر حفظ المعلومات."); return; }
      setName(data.user.name); setEmail(data.user.email); setCurrent(""); setPassword(""); setConfirm("");
      setMessage(data.message || "تم حفظ المعلومات.");
    } catch { setError("تعذر الاتصال بالخادم، تحقق من المعلومات قبل إعادة المحاولة."); }
    finally { pending.current = false; setSaving(false); }
  }
  return <div className="max-w-xl space-y-5"><h1 className="text-2xl font-bold">معلومات المدير</h1>
    {error && <p role="alert" className="text-rose-700 text-sm">{error}</p>}
    {message && <p role="status" className="text-emerald-700 text-sm">{message}</p>}
    <form onSubmit={submit} className="bg-white border border-[#D8C8B5] p-6 space-y-4">
      <label className="block text-sm">الاسم<input required minLength={2} value={name} onChange={e => setName(e.target.value)} className="block w-full border p-2" /></label>
      <label className="block text-sm">البريد الإلكتروني<input required type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} className="block w-full border p-2" /></label>
      <p className="text-xs">اترك حقول كلمة المرور فارغة إذا لم ترغب بتغييرها.</p>
      <label className="block text-sm">كلمة المرور الحالية<input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} className="block w-full border p-2" /></label>
      <label className="block text-sm">كلمة المرور الجديدة<input type="password" minLength={6} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="block w-full border p-2" /></label>
      <label className="block text-sm">تأكيد كلمة المرور الجديدة<input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="block w-full border p-2" /></label>
      <button disabled={saving || loading} className="bg-[#111111] text-white px-5 py-2 disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ المعلومات"}</button>
    </form></div>;
}
