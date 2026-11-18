"use client";
import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import { CUSTOMER_ACCOUNT_VISIBLE } from "@/lib/customer-account-visibility";

export default function RecoveryPage() {
  if (!CUSTOMER_ACCOUNT_VISIBLE) notFound();
  return <RecoveryForm />;
}

function RecoveryForm() {
  const [tokens, setTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("يرجى فتح رابط الاستعادة المرسل إلى بريدك.");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(location.hash.slice(1));
    const accessToken = hash.get("access_token"), refreshToken = hash.get("refresh_token");
    // Do not retain tokens in browser history or leak them to later navigations.
    history.replaceState(null, "", location.pathname);
    if (hash.get("type") === "recovery" && accessToken && refreshToken) {
      setTokens({ accessToken, refreshToken }); setMessage("");
    }
  }, []);
  return <main dir="rtl" className="max-w-md mx-auto p-8"><h1 className="font-editorial text-3xl mb-6">استعادة كلمة المرور</h1>
    {tokens && <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setBusy(true); try {
      const res = await fetch("/api/store/customer/auth/recover-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...tokens, password }) });
      const data = await res.json(); setMessage(res.ok ? data.message : data.error); if (res.ok) { setTokens(null); setPassword(""); }
    } catch { setMessage("تعذر الاتصال بالخادم."); } finally { setBusy(false); } }}>
      <label className="block text-sm">كلمة المرور الجديدة<input className="mt-2 w-full border p-3" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <button disabled={busy} className="bg-[#111111] text-white px-6 py-3">حفظ كلمة المرور</button></form>}
    {message && <p role="status" className="mt-4 text-sm">{message}</p>}<a href="/" className="block mt-6 underline text-sm">العودة للمتجر</a></main>;
}
