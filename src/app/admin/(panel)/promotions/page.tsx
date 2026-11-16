"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Edit3, Trash2, Check, X, Loader2, Percent } from "lucide-react";
import { formatIQD } from "@/lib/format";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface PromotionRow {
  id: number;
  name: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  scope_type: "all" | "gender" | "category" | "products";
  gender_id: number | null;
  gender_name: string | null;
  category_id: number | null;
  category_name: string | null;
  product_ids_json: string;
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
}

const SCOPE_LABELS: Record<string, string> = {
  all: "جميع المنتجات",
  gender: "قسم محدد",
  category: "تصنيف محدد",
  products: "منتجات محددة",
};

export default function AdminPromotionsPage() {
  const [promos, setPromos] = useState<PromotionRow[]>([]);
  const [genders, setGenders] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<
    { id: number; gender_id: number; name: string }[]
  >([]);
  const [products, setProducts] = useState<
    { id: number; name: string; sku: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromotionRow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("15");
  const [scopeType, setScopeType] = useState<"all" | "gender" | "category" | "products">("all");
  const [genderId, setGenderId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [productIds, setProductIds] = useState<number[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PromotionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3200);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promotions", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setPromos(data.promotions || []);
        setGenders(data.genders || []);
        setCategories(data.categories || []);
        setProducts(data.products || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue("15");
    setScopeType("all");
    setGenderId("");
    setCategoryId("");
    setProductIds([]);
    setStartsAt("");
    setEndsAt("");
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (p: PromotionRow) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description || "");
    setDiscountType(p.discount_type);
    setDiscountValue(String(p.discount_value));
    setScopeType(p.scope_type);
    setGenderId(p.gender_id ? String(p.gender_id) : "");
    setCategoryId(p.category_id ? String(p.category_id) : "");
    try {
      setProductIds(JSON.parse(p.product_ids_json || "[]"));
    } catch {
      setProductIds([]);
    }
    setStartsAt(p.starts_at ? p.starts_at.slice(0, 10) : "");
    setEndsAt(p.ends_at ? p.ends_at.slice(0, 10) : "");
    setIsActive(Boolean(p.is_active));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name,
      description,
      discount_type: discountType,
      discount_value: Math.round(Number(discountValue) || 0),
      scope_type: scopeType,
      gender_id: genderId ? Number(genderId) : null,
      category_id: categoryId ? Number(categoryId) : null,
      product_ids: productIds,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      is_active: isActive,
    };
    const url = editing
      ? `/api/admin/promotions/${editing.id}`
      : "/api/admin/promotions";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      flash(data.message || "تم حفظ العرض بنجاح.");
      loadData();
    }
  };

  const toggleActive = async (p: PromotionRow) => {
    const res = await fetch(`/api/admin/promotions/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    if (res.ok) {
      flash(p.is_active ? "تم إيقاف العرض." : "تم تفعيل العرض وتطبيقه على المتجر.");
      loadData();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/promotions/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    setDeleteTarget(null);
    if (res.ok) {
      flash("تم حذف العرض بنجاح.");
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl text-[#111111]">
            إدارة العروض والخصومات
          </h1>
          <p className="text-xs text-[#111111]/60 mt-1">
            تُطبق العروض المفعلة تلقائيًا على أسعار المنتجات والسلة والدفع بالدينار العراقي (د.ع)
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111] transition"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء عرض جديد</span>
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
          <span>جاري تحميل العروض...</span>
        </div>
      ) : promos.length === 0 ? (
        <div className="bg-white border border-[#D8C8B5] p-12 text-center text-sm text-[#111111]/60">
          لا توجد عروض مسجلة حاليًا.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promos.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-[#D8C8B5]/80 p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-[#111111] text-[#B79B6C] flex items-center justify-center shrink-0">
                      <Percent className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-[#111111]">
                        {p.name}
                      </h2>
                      <p className="text-xs font-semibold text-[#B79B6C]">
                        {p.discount_type === "percentage"
                          ? `خصم ${p.discount_value}٪`
                          : `خصم ثابت ${formatIQD(p.discount_value)}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    className={`px-3 py-1 text-[11px] font-semibold border transition ${
                      p.is_active
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-stone-100 text-stone-600 border-stone-300"
                    }`}
                  >
                    {p.is_active ? "نشط" : "متوقف"}
                  </button>
                </div>

                {p.description && (
                  <p className="text-xs text-[#111111]/70">{p.description}</p>
                )}

                <div className="flex flex-wrap gap-2 text-[11px] text-[#111111]/65 pt-1">
                  <span className="px-2 py-0.5 bg-[#F7F4EF] border border-[#D8C8B5]/60">
                    النطاق: {SCOPE_LABELS[p.scope_type] || p.scope_type}
                    {p.gender_name ? ` — ${p.gender_name}` : ""}
                    {p.category_name ? ` — ${p.category_name}` : ""}
                  </span>
                  {(p.starts_at || p.ends_at) && (
                    <span className="px-2 py-0.5 bg-[#F7F4EF] border border-[#D8C8B5]/60">
                      {p.starts_at ? `من ${p.starts_at.slice(0, 10)}` : ""}{" "}
                      {p.ends_at ? `إلى ${p.ends_at.slice(0, 10)}` : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D8C8B5]/50">
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  className="px-3 py-1.5 border border-[#D8C8B5] hover:border-[#111111] text-xs font-medium flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(p)}
                  className="px-3 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#111111]/60 backdrop-blur-xs"
            onClick={() => setModalOpen(false)}
          />
          <form
            onSubmit={handleSave}
            className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-[#D8C8B5] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D8C8B5]/60">
              <h2 className="text-base font-bold">
                {editing ? "تعديل العرض" : "إنشاء عرض جديد"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                اسم العرض <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: خصم 20٪ — تخفيضات موسمية"
                className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">الوصف</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  نوع الخصم
                </label>
                <select
                  value={discountType}
                  onChange={(e) =>
                    setDiscountType(e.target.value as "percentage" | "fixed")
                  }
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm bg-white"
                >
                  <option value="percentage">نسبة مئوية (٪)</option>
                  <option value="fixed">مبلغ ثابت (د.ع)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  {discountType === "percentage"
                    ? "نسبة الخصم (٪)"
                    : "قيمة الخصم (د.ع)"}
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={discountType === "percentage" ? 90 : 10000000}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                نطاق تطبيق العرض
              </label>
              <select
                value={scopeType}
                onChange={(e) =>
                  setScopeType(
                    e.target.value as "all" | "gender" | "category" | "products"
                  )
                }
                className="w-full border border-[#D8C8B5] px-3 py-2 text-sm bg-white"
              >
                <option value="all">جميع المنتجات</option>
                <option value="gender">قسم محدد (رجالي أو نسائي)</option>
                <option value="category">تصنيف محدد</option>
                <option value="products">منتجات محددة</option>
              </select>
            </div>

            {scopeType === "gender" && (
              <div>
                <label className="block text-xs font-semibold mb-1">
                  اختر القسم
                </label>
                <select
                  required
                  value={genderId}
                  onChange={(e) => setGenderId(e.target.value)}
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm bg-white"
                >
                  <option value="">اختر القسم</option>
                  {genders.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scopeType === "category" && (
              <div>
                <label className="block text-xs font-semibold mb-1">
                  اختر التصنيف
                </label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm bg-white"
                >
                  <option value="">اختر التصنيف</option>
                  {categories.map((c) => {
                    const gName =
                      genders.find((g) => g.id === c.gender_id)?.name || "";
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} ({gName})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {scopeType === "products" && (
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  اختر المنتجات ({productIds.length})
                </label>
                <div className="max-h-40 overflow-y-auto border border-[#D8C8B5] p-2 space-y-1.5">
                  {products.map((pr) => (
                    <label
                      key={pr.id}
                      className="flex items-center gap-2 text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={productIds.includes(pr.id)}
                        onChange={() =>
                          setProductIds((prev) =>
                            prev.includes(pr.id)
                              ? prev.filter((id) => id !== pr.id)
                              : [...prev, pr.id]
                          )
                        }
                        className="accent-[#111111]"
                      />
                      <span>
                        {pr.name} ({pr.sku})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  تاريخ البداية
                </label>
                <input
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  تاريخ النهاية
                </label>
                <input
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-xs"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-[#111111] w-4 h-4"
              />
              <span>تفعيل العرض فورًا</span>
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D8C8B5]/60">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 border border-[#D8C8B5] text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111]"
              >
                {saving ? "جاري الحفظ..." : "حفظ العرض"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="تأكيد حذف العرض"
        message={`هل تريد حذف العرض "${deleteTarget?.name || ""}" نهائيًا؟`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
