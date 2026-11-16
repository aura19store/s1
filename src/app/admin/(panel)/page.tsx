"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  FolderKanban,
  EyeOff,
  AlertTriangle,
  PackageX,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Banknote,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { formatArabicDate, formatIQD, formatNumber } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "@/lib/constants";

interface DashboardData {
  kpis: {
    totalProducts: number;
    menProducts: number;
    womenProducts: number;
    totalCategories: number;
    hiddenProducts: number;
    outOfStockProducts: number;
    lowStockProducts: number;
    totalOrders: number;
    newOrders: number;
    pendingOrders: number;
    completedOrders: number;
    totalRevenueIqd: number;
  };
  ordersByStatus: { status: string; count: number; total_iqd: number }[];
  dailyRevenue: { day: string; revenue_iqd: number; orders_count: number }[];
  recentOrders: {
    id: number;
    order_number: string;
    customer_name: string;
    governorate: string;
    total_iqd: number;
    status: string;
    created_at: string;
  }[];
  lowStockProducts: {
    id: number;
    name: string;
    sku: string;
    stock_quantity: number;
    low_stock_threshold: number;
    gender_name: string;
  }[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!json.error) setData(json);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
        <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
        <span>جاري تحميل الإحصائيات...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-white border border-[#D8C8B5] text-sm">
        تعذر تحميل بيانات لوحة المعلومات.
      </div>
    );
  }

  const { kpis } = data;
  const maxDayRev = Math.max(
    1,
    ...data.dailyRevenue.map((d) => Number(d.revenue_iqd || 0))
  );
  const totalGenderProds = Math.max(1, kpis.menProducts + kpis.womenProducts);
  const menPct = Math.round((kpis.menProducts / totalGenderProds) * 100);
  const womenPct = 100 - menPct;

  const kpiCards = [
    {
      label: "إجمالي الإيرادات",
      value: formatIQD(kpis.totalRevenueIqd),
      sub: "بالدينار العراقي",
      icon: Banknote,
      highlight: true,
    },
    {
      label: "إجمالي المنتجات",
      value: formatNumber(kpis.totalProducts),
      sub: `رجالي: ${kpis.menProducts} • نسائي: ${kpis.womenProducts}`,
      icon: Package,
    },
    {
      label: "منتجات الرجالي",
      value: formatNumber(kpis.menProducts),
      sub: `${menPct}٪ من الإجمالي`,
      icon: Package,
    },
    {
      label: "منتجات النسائي",
      value: formatNumber(kpis.womenProducts),
      sub: `${womenPct}٪ من الإجمالي`,
      icon: Package,
    },
    {
      label: "التصنيفات",
      value: formatNumber(kpis.totalCategories),
      sub: "تصنيفات ديناميكية",
      icon: FolderKanban,
    },
    {
      label: "المنتجات المخفية",
      value: formatNumber(kpis.hiddenProducts),
      sub: "غير ظاهرة في المتجر",
      icon: EyeOff,
    },
    {
      label: "غير المتوفرة",
      value: formatNumber(kpis.outOfStockProducts),
      sub: "المخزون يساوي صفر",
      icon: PackageX,
      warn: kpis.outOfStockProducts > 0,
    },
    {
      label: "منخفضة المخزون",
      value: formatNumber(kpis.lowStockProducts),
      sub: "تحتاج إعادة تزويد",
      icon: AlertTriangle,
      warn: kpis.lowStockProducts > 0,
    },
    {
      label: "الطلبات الجديدة",
      value: formatNumber(kpis.newOrders),
      sub: "بانتظار المتابعة",
      icon: ShoppingCart,
    },
    {
      label: "الطلبات قيد الانتظار",
      value: formatNumber(kpis.pendingOrders),
      sub: "قيد التجهيز والشحن",
      icon: Clock,
    },
    {
      label: "الطلبات المكتملة",
      value: formatNumber(kpis.completedOrders),
      sub: "تم تسليمها بنجاح",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#B79B6C] mb-1">
            نظرة عامة فورية على أداء المتجر
          </p>
          <h1 className="font-editorial text-3xl sm:text-4xl text-[#111111]">
            لوحة المعلومات الرئيسية
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/products/new"
            className="px-5 py-2.5 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111] transition"
          >
            إضافة منتج جديد
          </Link>
          <Link
            href="/admin/orders"
            className="px-5 py-2.5 bg-white border border-[#D8C8B5] text-[#111111] text-xs font-semibold hover:border-[#111111] transition"
          >
            متابعة الطلبات
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`p-5 border transition ${
                card.highlight
                  ? "bg-[#111111] text-[#F7F4EF] border-[#B79B6C]/50 col-span-2 sm:col-span-1"
                  : card.warn
                  ? "bg-amber-50/70 border-amber-200 text-[#111111]"
                  : "bg-white border-[#D8C8B5]/70 text-[#111111]"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className={`text-xs font-medium ${
                    card.highlight ? "text-[#D8C8B5]" : "text-[#111111]/65"
                  }`}
                >
                  {card.label}
                </span>
                <Icon
                  className={`w-4 h-4 ${
                    card.highlight
                      ? "text-[#B79B6C]"
                      : card.warn
                      ? "text-amber-700"
                      : "text-[#B79B6C]"
                  }`}
                />
              </div>
              <p className="text-xl sm:text-2xl font-bold tracking-tight">
                {card.value}
              </p>
              <p
                className={`text-[11px] mt-1.5 ${
                  card.highlight ? "text-[#D8C8B5]/70" : "text-[#111111]/55"
                }`}
              >
                {card.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Revenue Chart (IQD) */}
        <div className="lg:col-span-7 bg-white border border-[#D8C8B5]/70 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold text-[#111111]">
                الإيرادات اليومية بالدينار العراقي
              </h2>
              <p className="text-xs text-[#111111]/55 mt-0.5">
                إجمالي مبيعات الطلبات الفعالة (د.ع)
              </p>
            </div>
            <span className="text-xs font-semibold text-[#B79B6C]">
              {formatIQD(kpis.totalRevenueIqd)}
            </span>
          </div>

          {data.dailyRevenue.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#111111]/55">
              لا توجد بيانات مبيعات مسجلة بعد.
            </p>
          ) : (
            <div className="space-y-3">
              {data.dailyRevenue.map((row) => {
                const widthPct = Math.max(
                  6,
                  Math.round((Number(row.revenue_iqd) / maxDayRev) * 100)
                );
                return (
                  <div key={row.day} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#111111]/75 font-medium">
                        {formatArabicDate(row.day)} ({row.orders_count} طلب)
                      </span>
                      <span className="font-semibold text-[#111111]">
                        {formatIQD(row.revenue_iqd)}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-[#EFEAE2] overflow-hidden">
                      <div
                        className="h-full bg-[#111111] border-l-4 border-[#B79B6C] transition-all duration-700"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Orders by Status + Men/Women Split */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#D8C8B5]/70 p-6 space-y-4">
            <h2 className="text-base font-bold text-[#111111]">
              توزيع حالات الطلبات
            </h2>
            <div className="space-y-2.5">
              {data.ordersByStatus.map((st) => (
                <div
                  key={st.status}
                  className="flex items-center justify-between text-xs py-2 border-b border-[#D8C8B5]/40 last:border-0"
                >
                  <span
                    className={`px-2.5 py-1 border font-medium ${
                      ORDER_STATUS_STYLES[st.status] || "bg-stone-100"
                    }`}
                  >
                    {ORDER_STATUS_LABELS[st.status] || st.status}
                  </span>
                  <div className="text-left">
                    <span className="font-bold text-[#111111] ml-3">
                      {st.count} طلب
                    </span>
                    <span className="text-[#111111]/60">
                      ({formatIQD(st.total_iqd)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#D8C8B5]/70 p-6 space-y-4">
            <h2 className="text-base font-bold text-[#111111]">
              توزيع المنتجات بين الرجالي والنسائي
            </h2>
            <div className="w-full h-4 bg-[#EFEAE2] flex overflow-hidden">
              <div
                className="h-full bg-[#111111]"
                style={{ width: `${menPct}%` }}
                title={`الرجالي: ${menPct}٪`}
              />
              <div
                className="h-full bg-[#B79B6C]"
                style={{ width: `${womenPct}%` }}
                title={`النسائي: ${womenPct}٪`}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#111111]" />
                <span>
                  الرجالي: <strong>{kpis.menProducts}</strong> ({menPct}٪)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-[#B79B6C]" />
                <span>
                  النسائي: <strong>{kpis.womenProducts}</strong> ({womenPct}٪)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Tables: Recent Orders & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#D8C8B5]/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#111111]">أحدث الطلبات</h2>
            <Link
              href="/admin/orders"
              className="text-xs font-medium text-[#B79B6C] hover:text-[#111111] flex items-center gap-1"
            >
              <span>عرض الكل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#D8C8B5]/70 text-[#111111]/60 text-right">
                  <th className="pb-2.5 font-semibold">رقم الطلب</th>
                  <th className="pb-2.5 font-semibold">العميل</th>
                  <th className="pb-2.5 font-semibold">المحافظة</th>
                  <th className="pb-2.5 font-semibold">الإجمالي</th>
                  <th className="pb-2.5 font-semibold">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8C8B5]/40">
                {data.recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#F7F4EF]/50">
                    <td className="py-3 font-semibold text-[#111111]">
                      {o.order_number}
                    </td>
                    <td className="py-3">{o.customer_name}</td>
                    <td className="py-3 text-[#111111]/70">{o.governorate}</td>
                    <td className="py-3 font-semibold">
                      {formatIQD(o.total_iqd)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 border text-[11px] ${
                          ORDER_STATUS_STYLES[o.status] || ""
                        }`}
                      >
                        {ORDER_STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#D8C8B5]/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#111111]">
              تنبيهات المخزون المنخفض
            </h2>
            <Link
              href="/admin/inventory"
              className="text-xs font-medium text-[#B79B6C] hover:text-[#111111] flex items-center gap-1"
            >
              <span>إدارة المخزون</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
          {data.lowStockProducts.length === 0 ? (
            <p className="py-8 text-center text-xs text-emerald-700">
              جميع المنتجات متوفرة بمستويات مخزون آمنة.
            </p>
          ) : (
            <div className="space-y-3">
              {data.lowStockProducts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-[#F7F4EF]/70 border border-[#D8C8B5]/60 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#111111] truncate">
                      {p.name}
                    </p>
                    <p className="text-[11px] text-[#111111]/55">
                      {p.gender_name} • {p.sku}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 font-bold shrink-0 ${
                      p.stock_quantity <= 0
                        ? "bg-rose-100 text-rose-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {p.stock_quantity <= 0
                      ? "نفد المخزون"
                      : `متبقي ${p.stock_quantity}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
