"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatIQD } from "@/lib/format";
import { GUEST_ORDER_STATUS_LABELS } from "@/lib/guest-order-status";

type Order = { order_number: string; status: string; total_iqd: number; created_at: string };

export function GuestOrders({ gender }: { gender: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/store/orders", { cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => { if (mounted) setOrders(data.orders); })
      .catch(() => { if (mounted) setError("تعذر تحميل الطلبات، يرجى المحاولة مجددًا."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return <main className="max-w-4xl mx-auto px-4 py-10 space-y-8" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="font-editorial text-3xl">طلباتي</h1><p className="text-sm text-[#111111]/65 mt-2">الطلبات المرتبطة بهذا المتصفح.</p></div>
      <Link href={`/store/${gender}/track-order`} className="min-h-11 inline-flex items-center justify-center bg-[#111111] text-[#F7F4EF] px-6 font-semibold">تتبع طلب</Link>
    </div>
    {error ? <p role="alert">{error}</p> : loading ? <p>جاري تحميل الطلبات…</p> : orders.length === 0 ? <p>لا توجد طلبات مرتبطة بهذا المتصفح. يمكنك تتبع طلب باستخدام رقم الطلب ورمز التتبع.</p> :
      <ul className="grid sm:grid-cols-2 gap-4">{orders.map(o => <li key={o.order_number} className="bg-white border border-[#D8C8B5] p-5 space-y-3">
        <h2 className="font-semibold">الطلب #{o.order_number}</h2>
        <p>الحالة: {GUEST_ORDER_STATUS_LABELS[o.status] || "غير متاحة"}</p>
        <p>المبلغ: {formatIQD(Number(o.total_iqd))}</p>
        <Link className="flex min-h-11 justify-center items-center bg-[#111111] text-[#F7F4EF] px-4" href={`/store/${gender}/orders/${encodeURIComponent(o.order_number)}`}>تتبع الطلب</Link>
      </li>)}</ul>}
  </main>;
}
