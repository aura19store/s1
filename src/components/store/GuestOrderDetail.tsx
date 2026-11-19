"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatIQD } from "@/lib/format";
import { GUEST_ORDER_STATUS_LABELS } from "@/lib/guest-order-status";
type Item = {product_name: string; variant_label: string; quantity: number; total_price_iqd: number};
type Order = {order_number: string; status: string; total_iqd: number; customer_name: string; city: string; governorate: string};
export function GuestOrderDetail({ gender, number }: {gender: string; number: string}) {
  const [result, setResult] = useState<{order: Order; items: Item[]} | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let current=true; setLoading(true); setResult(null); fetch(`/api/store/orders/${encodeURIComponent(number)}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{if(current)setResult(data)}).catch(()=>{}).finally(()=>{if(current)setLoading(false)}); return()=>{current=false}; },[number]);
  return <main className="max-w-3xl mx-auto px-4 py-10 space-y-5" dir="rtl"><h1 className="font-editorial text-3xl">تتبع الطلب</h1>{loading ? <p>جاري تحميل الطلب…</p> : !result ? <p role="alert">الطلب غير متاح أو تم حذفه، أو تحتاج إلى بيانات التتبع الصحيحة.</p> : <section className="bg-white border border-[#D8C8B5] p-6 space-y-4"><h2 className="font-semibold text-xl">الطلب #{result.order.order_number}</h2><p>الحالة: {GUEST_ORDER_STATUS_LABELS[result.order.status] || 'غير متاحة'}</p><p>الاسم: {result.order.customer_name}</p><p>التوصيل: {result.order.governorate}، {result.order.city}</p><ul className="divide-y divide-[#D8C8B5]">{result.items.map((it,i)=><li key={i} className="py-3"><span>{it.product_name} {it.variant_label} × {it.quantity}</span><span className="block font-semibold">{formatIQD(Number(it.total_price_iqd))}</span></li>)}</ul><p className="font-semibold">الإجمالي: {formatIQD(Number(result.order.total_iqd))}</p></section>}<Link className="inline-block underline min-h-11" href={`/store/${gender}/orders`}>العودة إلى طلباتي</Link></main>;
}
