"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatIQD } from "@/lib/format";
import { GUEST_ORDER_STATUS_LABELS } from "@/lib/guest-order-status";
import { RewardsWheel } from "@/components/store/RewardsWheel";

type Order = {
  order_number: string;
  status: string;
  total_iqd: number;
  created_at: string;
};

export function GuestOrders({ gender }: { gender: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    fetch("/api/store/orders", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        if (mounted) setOrders(data.orders);
      })
      .catch(() => {
        if (mounted) setError("تعذر تحميل الطلبات، يرجى المحاولة مجددًا.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-10 space-y-8" dir="rtl">
      <div>
        <h1 className="font-editorial text-3xl">طلباتي</h1>
      </div>

      <RewardsWheel />

      {error ? (
        <p role="alert">{error}</p>
      ) : loading ? (
        <p>جاري تحميل الطلبات…</p>
      ) : orders.length === 0 ? (
        <p>لا توجد طلبات. يمكنك تتبع طلب باستخدام رقم الطلب ورمز التتبع.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-4">
          {orders.map((order) => (
            <li
              key={order.order_number}
              className="bg-white border border-[#D8C8B5] p-5 space-y-3"
            >
              <h2 className="font-semibold">
                الطلب #{order.order_number}
              </h2>

              <p>
                الحالة: {GUEST_ORDER_STATUS_LABELS[order.status] || "غير متاحة"}
              </p>

              <p>
                المبلغ: {formatIQD(Number(order.total_iqd))}
              </p>

              <Link
                className="flex min-h-11 justify-center items-center bg-[#111111] text-[#F7F4EF] px-4"
                href={`/store/${gender}/orders/${encodeURIComponent(order.order_number)}`}
              >
                تتبع الطلب
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}