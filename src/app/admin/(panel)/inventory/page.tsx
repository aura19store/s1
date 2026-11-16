"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Save } from "lucide-react";
import { formatIQD } from "@/lib/format";

interface InventoryRow {
  id: number;
  sku: string;
  name: string;
  stock_quantity: number;
  low_stock_threshold: number;
  status: string;
  price_iqd: number;
  gender_name: string;
  category_name: string | null;
  primary_image: string | null;
}

export default function AdminInventoryPage() {
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [counts, setCounts] = useState({ in_stock: 0, low_stock: 0, out_of_stock: 0 });
  const [draftStock, setDraftStock] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 2800);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory?filter=${filter}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        const map: Record<number, number> = {};
        for (const it of data.items || []) {
          map[it.id] = it.stock_quantity;
        }
        setDraftStock(map);

        const c = { in_stock: 0, low_stock: 0, out_of_stock: 0 };
        for (const s of data.summary || []) {
          if (s.status_bucket === "in_stock") c.in_stock = s.cnt;
          if (s.status_bucket === "low_stock") c.low_stock = s.cnt;
          if (s.status_bucket === "out_of_stock") c.out_of_stock = s.cnt;
        }
        setCounts(c);
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveStock = async (productId: number) => {
    const qty = Math.max(0, Number(draftStock[productId] ?? 0));
    const res = await fetch("/api/admin/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, stock_quantity: qty }),
    });
    if (res.ok) {
      flash("تم تحديث كمية المخزون في المتجر مباشرة.");
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-editorial text-3xl text-[#111111]">إدارة المخزون</h1>
        <p className="text-xs text-[#111111]/60 mt-1">
          مراقبة وتحديث كميات المنتجات وتنبيهات المخزون المنخفض والمنتجات غير المتوفرة
        </p>
      </div>

      {(counts.low_stock > 0 || counts.out_of_stock > 0) && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700" />
          <span>
            تنبيه المخزون: لديك <strong>{counts.out_of_stock}</strong> منتج غير
            متوفر و <strong>{counts.low_stock}</strong> منتج بمخزون منخفض يحتاج
            إعادة تزويد.
          </span>
        </div>
      )}

      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          {
            key: "all",
            label: `الكل (${counts.in_stock + counts.low_stock + counts.out_of_stock})`,
          },
          { key: "in_stock", label: `متوفر (${counts.in_stock})` },
          { key: "low_stock", label: `مخزون منخفض (${counts.low_stock})` },
          { key: "out_of_stock", label: `غير متوفر (${counts.out_of_stock})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-xs font-semibold border transition ${
              filter === tab.key
                ? "bg-[#111111] text-[#F7F4EF] border-[#111111]"
                : "bg-white text-[#111111]/80 border-[#D8C8B5]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D8C8B5]/70 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
            <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
            <span>جاري تحميل بيانات المخزون...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-14 text-center text-sm text-[#111111]/60">
            لا توجد منتجات ضمن هذا التصنيف.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#EFEAE2]/70 border-b border-[#D8C8B5] text-right">
                  <th className="py-3.5 px-4 font-semibold">المنتج</th>
                  <th className="py-3.5 px-3 font-semibold">القسم</th>
                  <th className="py-3.5 px-3 font-semibold">السعر</th>
                  <th className="py-3.5 px-3 font-semibold">حالة المخزون</th>
                  <th className="py-3.5 px-4 font-semibold">تحديث الكمية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8C8B5]/50">
                {items.map((it) => {
                  const state =
                    it.stock_quantity <= 0
                      ? { label: "غير متوفر", cls: "bg-rose-50 text-rose-800 border-rose-200" }
                      : it.stock_quantity <= it.low_stock_threshold
                      ? { label: "مخزون منخفض", cls: "bg-amber-50 text-amber-800 border-amber-200" }
                      : { label: "متوفر", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" };
                  return (
                    <tr key={it.id} className="hover:bg-[#F7F4EF]/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={it.primary_image || "/images/brand-story.jpg"}
                            alt={it.name}
                            className="w-10 h-11 object-cover bg-[#EFEAE2]"
                          />
                          <div>
                            <p className="font-semibold text-[#111111]">
                              {it.name}
                            </p>
                            <p className="text-[11px] text-[#111111]/55">
                              {it.sku} • {it.category_name || "بدون تصنيف"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">{it.gender_name}</td>
                      <td className="py-3 px-3 font-semibold">
                        {formatIQD(it.price_iqd)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-1 border text-[11px] font-medium ${state.cls}`}
                        >
                          {state.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={draftStock[it.id] ?? it.stock_quantity}
                            onChange={(e) =>
                              setDraftStock((prev) => ({
                                ...prev,
                                [it.id]: Number(e.target.value),
                              }))
                            }
                            className="w-20 border border-[#D8C8B5] px-2.5 py-1.5 text-xs text-center font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => saveStock(it.id)}
                            className="px-3 py-1.5 bg-[#111111] text-[#F7F4EF] hover:bg-[#B79B6C] hover:text-[#111111] text-xs font-medium flex items-center gap-1"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>حفظ</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
