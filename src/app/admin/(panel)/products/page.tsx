"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  Edit3,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Loader2,
  Check,
} from "lucide-react";
import { formatArabicDate, formatIQD } from "@/lib/format";
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_STYLES } from "@/lib/constants";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface AdminProductRow {
  id: number;
  sku: string;
  name: string;
  gender_id: number;
  gender_name: string;
  category_name: string | null;
  price_iqd: number;
  discount_price_iqd: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
  status: "active" | "hidden" | "draft";
  primary_image: string | null;
  created_at: string;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [genders, setGenders] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<
    { id: number; gender_id: number; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (search.trim()) sp.set("q", search.trim());
    if (genderFilter) sp.set("genderId", genderFilter);
    if (categoryFilter) sp.set("categoryId", categoryFilter);
    if (statusFilter) sp.set("status", statusFilter);

    try {
      const res = await fetch(`/api/admin/products?${sp.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setGenders(data.genders || []);
        setCategories(data.categories || []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, genderFilter, categoryFilter, statusFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3200);
  };

  const toggleVisibility = async (p: AdminProductRow) => {
    const nextStatus = p.status === "hidden" ? "active" : "hidden";
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      flash(
        nextStatus === "hidden"
          ? "تم إخفاء المنتج من المتجر والبحث والفلاتر."
          : "تم إظهار المنتج في المتجر بنجاح."
      );
      loadProducts();
    }
  };

  const duplicateProduct = async (p: AdminProductRow) => {
    const res = await fetch(`/api/admin/products/${p.id}/duplicate`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      flash(data.message || "تم نسخ المنتج بنجاح.");
      loadProducts();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/products/${deleteTarget.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setDeleting(false);
    setDeleteTarget(null);
    if (res.ok) {
      flash(data.message || "تم حذف المنتج نهائيًا.");
      loadProducts();
    }
  };

  const filteredCategories = genderFilter
    ? categories.filter((c) => String(c.gender_id) === genderFilter)
    : categories;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl text-[#111111]">
            إدارة المنتجات
          </h1>
          <p className="text-xs text-[#111111]/60 mt-1">
            عرض وإدارة جميع منتجات المتجر بالأسعار بالدينار العراقي ({products.length} منتج)
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111] transition"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة منتج</span>
        </Link>
      </div>

      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Search & Filters Bar */}
      <div className="bg-white border border-[#D8C8B5]/70 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#111111]/45 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم المنتج أو الرمز..."
            className="w-full border border-[#D8C8B5] pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-[#111111]"
          />
        </div>

        <select
          value={genderFilter}
          onChange={(e) => {
            setGenderFilter(e.target.value);
            setCategoryFilter("");
          }}
          className="border border-[#D8C8B5] px-3 py-2 text-xs bg-white focus:outline-none focus:border-[#111111]"
        >
          <option value="">جميع الأقسام (رجالي / نسائي)</option>
          {genders.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="border border-[#D8C8B5] px-3 py-2 text-xs bg-white focus:outline-none focus:border-[#111111]"
        >
          <option value="">جميع التصنيفات</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-[#D8C8B5] px-3 py-2 text-xs bg-white focus:outline-none focus:border-[#111111]"
        >
          <option value="">جميع الحالات</option>
          <option value="active">نشط</option>
          <option value="hidden">مخفي</option>
          <option value="draft">مسودة</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D8C8B5]/70 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
            <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
            <span>جاري تحميل المنتجات...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#111111]/60">
            لا توجد منتجات مطابقة لخيارات البحث الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#EFEAE2]/70 border-b border-[#D8C8B5] text-right text-[#111111]/75">
                  <th className="py-3.5 px-4 font-semibold">المنتج</th>
                  <th className="py-3.5 px-3 font-semibold">التصنيف</th>
                  <th className="py-3.5 px-3 font-semibold">القسم</th>
                  <th className="py-3.5 px-3 font-semibold">السعر</th>
                  <th className="py-3.5 px-3 font-semibold">المخزون</th>
                  <th className="py-3.5 px-3 font-semibold">الحالة</th>
                  <th className="py-3.5 px-3 font-semibold">تاريخ الإنشاء</th>
                  <th className="py-3.5 px-4 font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8C8B5]/50">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F7F4EF]/50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3 min-w-[200px]">
                        <img
                          src={p.primary_image || "/images/brand-story.jpg"}
                          alt={p.name}
                          className="w-11 h-12 object-cover bg-[#EFEAE2] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-[#111111] truncate max-w-[220px]">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-[#111111]/50">
                            {p.sku}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-[#111111]/80">
                      {p.category_name || "بدون تصنيف"}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 bg-[#EFEAE2] text-[#111111] font-medium">
                        {p.gender_name}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <p className="font-semibold text-[#111111]">
                        {formatIQD(p.discount_price_iqd ?? p.price_iqd)}
                      </p>
                      {p.discount_price_iqd && (
                        <p className="text-[11px] text-[#111111]/45 line-through">
                          {formatIQD(p.price_iqd)}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          p.stock_quantity <= 0
                            ? "text-rose-700"
                            : p.stock_quantity <= p.low_stock_threshold
                            ? "text-amber-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {p.stock_quantity} قطعة
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 border text-[11px] font-medium ${
                          PRODUCT_STATUS_STYLES[p.status] || ""
                        }`}
                      >
                        {PRODUCT_STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-[#111111]/65">
                      {formatArabicDate(p.created_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/admin/products/${p.id}/edit`}
                          title="تعديل"
                          className="p-1.5 border border-[#D8C8B5] hover:border-[#111111] text-[#111111]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleVisibility(p)}
                          title={p.status === "hidden" ? "إظهار المنتج" : "إخفاء المنتج"}
                          className="p-1.5 border border-[#D8C8B5] hover:border-[#111111] text-[#111111]"
                        >
                          {p.status === "hidden" ? (
                            <Eye className="w-3.5 h-3.5 text-emerald-700" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-amber-700" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateProduct(p)}
                          title="نسخ المنتج"
                          className="p-1.5 border border-[#D8C8B5] hover:border-[#111111] text-[#111111]"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          title="حذف نهائي"
                          className="p-1.5 border border-rose-200 hover:bg-rose-50 text-rose-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="تأكيد الحذف النهائي للمنتج"
        message={`هل أنت متأكد من حذف المنتج "${deleteTarget?.name || ""}" نهائيًا؟ لا يمكن التراجع عن هذا الإجراء. يمكنك استخدام خيار "إخفاء المنتج" إذا أردت الاحتفاظ به داخل لوحة التحكم.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
