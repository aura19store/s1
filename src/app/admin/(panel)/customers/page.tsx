"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { formatArabicDate, formatIQD } from "@/lib/format";

interface CustomerRow {
  id: number;
  name: string;
  phone: string;
  email: string;
  orders_count: number;
  total_spent_iqd: number;
  last_order_at: string | null;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/customers?q=${encodeURIComponent(search.trim())}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-editorial text-3xl text-[#111111]">العملاء</h1>
        <p className="text-xs text-[#111111]/60 mt-1">
          سجل العملاء وإجمالي الإنفاق بالدينار العراقي ({customers.length} عميل)
        </p>
      </div>

      <div className="bg-white border border-[#D8C8B5]/70 p-4 max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-[#111111]/45 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، رقم الهاتف، أو البريد الإلكتروني..."
            className="w-full border border-[#D8C8B5] pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-[#111111]"
          />
        </div>
      </div>

      <div className="bg-white border border-[#D8C8B5]/70 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
            <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
            <span>جاري تحميل بيانات العملاء...</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="py-14 text-center text-sm text-[#111111]/60">
            لا توجد نتائج مطابقة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#EFEAE2]/70 border-b border-[#D8C8B5] text-right">
                  <th className="py-3.5 px-4 font-semibold">الاسم</th>
                  <th className="py-3.5 px-3 font-semibold">رقم الهاتف</th>
                  <th className="py-3.5 px-3 font-semibold">البريد الإلكتروني</th>
                  <th className="py-3.5 px-3 font-semibold">عدد الطلبات</th>
                  <th className="py-3.5 px-3 font-semibold">إجمالي الإنفاق</th>
                  <th className="py-3.5 px-4 font-semibold">آخر طلب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8C8B5]/50">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F7F4EF]/50">
                    <td className="py-3.5 px-4 font-semibold text-[#111111]">
                      {c.name}
                    </td>
                    <td className="py-3.5 px-3" dir="ltr">
                      <span className="inline-block text-right">{c.phone}</span>
                    </td>
                    <td className="py-3.5 px-3 text-[#111111]/70">
                      {c.email || "—"}
                    </td>
                    <td className="py-3.5 px-3 font-semibold">
                      {c.orders_count} طلب
                    </td>
                    <td className="py-3.5 px-3 font-bold text-[#111111]">
                      {formatIQD(c.total_spent_iqd)}
                    </td>
                    <td className="py-3.5 px-4 text-[#111111]/65">
                      {formatArabicDate(c.last_order_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
