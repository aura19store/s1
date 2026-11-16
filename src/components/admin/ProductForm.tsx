"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  ImagePlus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  Save,
} from "lucide-react";
import { MediaPickerModal } from "./MediaPickerModal";

interface ProductImageDraft {
  url: string;
  alt_text: string;
  is_primary: boolean;
}

interface AttributeDef {
  id: number;
  slug: string;
  name: string;
  type: string;
  values: { id: number; slug: string; value: string; color_hex: string }[];
}

export function ProductForm({ productId }: { productId?: number }) {
  const router = useRouter();
  const isEdit = Boolean(productId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);

  const [genders, setGenders] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<
    { id: number; gender_id: number; parent_id: number | null; name: string }[]
  >([]);
  const [attributes, setAttributes] = useState<AttributeDef[]>([]);

  // Form Fields
  const [name, setName] = useState("");
  const [sku, setSku] = useState(`AURA-${Math.floor(300 + Math.random() * 699)}`);
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState("");
  const [materialsInfo, setMaterialsInfo] = useState("");
  const [genderId, setGenderId] = useState<number>(1);
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [priceIqd, setPriceIqd] = useState<string>("35000");
  const [discountPriceIqd, setDiscountPriceIqd] = useState<string>("");
  const [stockQuantity, setStockQuantity] = useState<string>("10");
  const [lowStockThreshold, setLowStockThreshold] = useState<string>("5");
  const [status, setStatus] = useState<"active" | "hidden" | "draft">("active");
  const [isFeatured, setIsFeatured] = useState(false);
  const [isBestseller, setIsBestseller] = useState(false);
  const [isNewArrival, setIsNewArrival] = useState(true);
  const [isLimitedEdition, setIsLimitedEdition] = useState(false);
  const [tags, setTags] = useState("");
  const [images, setImages] = useState<ProductImageDraft[]>([]);
  const [selectedAttrValIds, setSelectedAttrValIds] = useState<number[]>([]);

  useEffect(() => {
    async function init() {
      try {
        const metaRes = await fetch("/api/admin/products", { cache: "no-store" });
        const meta = await metaRes.json();
        setGenders(meta.genders || []);
        setCategories(meta.categories || []);
        setAttributes(meta.attributes || []);
        if (meta.genders?.[0] && !isEdit) {
          setGenderId(meta.genders[0].id);
        }

        if (isEdit && productId) {
          const prodRes = await fetch(`/api/admin/products/${productId}`, {
            cache: "no-store",
          });
          if (prodRes.ok) {
            const { product: p } = await prodRes.json();
            setName(p.name || "");
            setSku(p.sku || "");
            setDescription(p.description || "");
            setDetails(p.details || "");
            setMaterialsInfo(p.materials_info || "");
            setGenderId(Number(p.gender_id));
            setCategoryId(p.category_id ? String(p.category_id) : "");
            setSubcategoryId(p.subcategory_id ? String(p.subcategory_id) : "");
            setPriceIqd(String(p.price_iqd ?? 0));
            setDiscountPriceIqd(
              p.discount_price_iqd ? String(p.discount_price_iqd) : ""
            );
            setStockQuantity(String(p.stock_quantity ?? 0));
            setLowStockThreshold(String(p.low_stock_threshold ?? 5));
            setStatus(p.status || "active");
            setIsFeatured(Boolean(p.is_featured));
            setIsBestseller(Boolean(p.is_bestseller));
            setIsNewArrival(Boolean(p.is_new_arrival));
            setIsLimitedEdition(Boolean(p.is_limited_edition));
            setTags(p.tags || "");
            setImages(
              (p.images || []).map(
                (i: { url: string; alt_text: string; is_primary: number }) => ({
                  url: i.url,
                  alt_text: i.alt_text || "",
                  is_primary: Boolean(i.is_primary),
                })
              )
            );
            setSelectedAttrValIds(p.attribute_value_ids || []);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [isEdit, productId]);

  const genderCategories = categories.filter(
    (c) => c.gender_id === genderId && !c.parent_id
  );
  const subCategories = categories.filter(
    (c) => c.gender_id === genderId && String(c.parent_id) === categoryId
  );

  const toggleAttrVal = (valId: number) => {
    setSelectedAttrValIds((prev) =>
      prev.includes(valId) ? prev.filter((id) => id !== valId) : [...prev, valId]
    );
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[idx], next[target]] = [next[target], next[idx]];
    setImages(next.map((img, i) => ({ ...img, is_primary: i === 0 })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const payload = {
      name,
      sku,
      description,
      details,
      materials_info: materialsInfo,
      gender_id: Number(genderId),
      category_id: categoryId ? Number(categoryId) : null,
      subcategory_id: subcategoryId ? Number(subcategoryId) : null,
      price_iqd: Math.round(Number(priceIqd) || 0),
      discount_price_iqd: discountPriceIqd
        ? Math.round(Number(discountPriceIqd))
        : null,
      stock_quantity: Math.max(0, Math.round(Number(stockQuantity) || 0)),
      low_stock_threshold: Math.max(1, Math.round(Number(lowStockThreshold) || 5)),
      status,
      is_featured: isFeatured,
      is_bestseller: isBestseller,
      is_new_arrival: isNewArrival,
      is_limited_edition: isLimitedEdition,
      tags,
      images: images.map((img, idx) => ({
        url: img.url,
        alt_text: img.alt_text || name,
        is_primary: idx === 0,
      })),
      attribute_value_ids: selectedAttrValIds,
    };

    try {
      const url = isEdit
        ? `/api/admin/products/${productId}`
        : "/api/admin/products";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذر حفظ المنتج.");
        setSaving(false);
        return;
      }
      router.push("/admin/products");
      router.refresh();
    } catch {
      setError("حدث خطأ في الاتصال.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
        <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
        <span>جاري تحميل بيانات النموذج...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products"
            className="p-2 bg-white border border-[#D8C8B5] hover:border-[#111111]"
            aria-label="العودة للمنتجات"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="font-editorial text-3xl text-[#111111]">
              {isEdit ? "تعديل المنتج" : "إضافة منتج جديد"}
            </h1>
            <p className="text-xs text-[#111111]/60 mt-0.5">
              جميع الأسعار تُسجل وتُعرض بالدينار العراقي (د.ع) فقط
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-[#111111] text-[#F7F4EF] hover:bg-[#B79B6C] hover:text-[#111111] text-xs font-semibold transition flex items-center justify-center gap-2 disabled:opacity-55"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saving ? "جاري الحفظ..." : "حفظ المنتج"}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Right Column: Main Info, Images, Attributes */}
        <div className="lg:col-span-8 space-y-6">
          {/* Basic Details */}
          <div className="bg-white border border-[#D8C8B5]/70 p-6 space-y-4">
            <h2 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
              المعلومات الأساسية
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1.5">
                  اسم المنتج <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: ساعة أوبسيديان السوداء المطفية"
                  className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  رمز المنتج <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="مثال: AURA-301"
                  className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  وسوم المنتج (مفصولة بفاصلة)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ساعة، أسود، فاخر، هدايا"
                  className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1.5">
                  الوصف
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف أنيق ومفصل للقطعة..."
                  className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  تفاصيل المنتج والمواصفات
                </label>
                <textarea
                  rows={2}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="المقاس، المقاومة للماء، التغليف..."
                  className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  الخامات والعناية
                </label>
                <textarea
                  rows={2}
                  value={materialsInfo}
                  onChange={(e) => setMaterialsInfo(e.target.value)}
                  placeholder="تفاصيل الخامة وطريقة العناية..."
                  className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-xs focus:outline-none focus:border-[#111111]"
                />
              </div>
            </div>
          </div>

          {/* Product Images + Reordering */}
          <div className="bg-white border border-[#D8C8B5]/70 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8C8B5]/50">
              <div>
                <h2 className="text-sm font-bold text-[#111111]">صور المنتج</h2>
                <p className="text-[11px] text-[#111111]/55">
                  الصورة الأولى هي الأساسية، والثانية تظهر عند مرور المؤشر على
                  البطاقة
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMediaOpen(true)}
                className="px-4 py-2 bg-[#EFEAE2] hover:bg-[#D8C8B5] text-xs font-semibold text-[#111111] flex items-center gap-1.5 transition"
              >
                <ImagePlus className="w-4 h-4" />
                <span>إضافة صورة</span>
              </button>
            </div>

            {images.length === 0 ? (
              <div className="py-10 border border-dashed border-[#D8C8B5] text-center text-xs text-[#111111]/55">
                لم تتم إضافة صور بعد. اضغط على &quot;إضافة صورة&quot; للرفع أو
                الاختيار من مكتبة الوسائط.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={`${img.url}-${idx}`}
                    className="border border-[#D8C8B5] bg-[#F7F4EF] p-2 space-y-2"
                  >
                    <div className="relative aspect-square overflow-hidden bg-white">
                      <img
                        src={img.url}
                        alt={img.alt_text || name}
                        className="w-full h-full object-cover"
                      />
                      {idx === 0 && (
                        <span className="absolute top-1.5 right-1.5 px-2 py-0.5 bg-[#111111] text-[#B79B6C] text-[10px] font-semibold">
                          رئيسية
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveImage(idx, -1)}
                          title="تقديم الصورة"
                          className="p-1 bg-white border border-[#D8C8B5] disabled:opacity-35"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === images.length - 1}
                          onClick={() => moveImage(idx, 1)}
                          title="تأخير الصورة"
                          className="p-1 bg-white border border-[#D8C8B5] disabled:opacity-35"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                        title="حذف الصورة"
                        className="p-1 bg-white border border-rose-200 text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Attributes (Colors, Materials, Sizes, Custom Filters) */}
          <div className="bg-white border border-[#D8C8B5]/70 p-6 space-y-5">
            <h2 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
              الخصائص والفلاتر المرتبطة (الألوان، الخامات، المقاسات وغيرها)
            </h2>
            {attributes.map((attr) => (
              <div key={attr.id}>
                <p className="text-xs font-semibold text-[#111111] mb-2.5">
                  {attr.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {attr.values.map((val) => {
                    const selected = selectedAttrValIds.includes(val.id);
                    return (
                      <button
                        key={val.id}
                        type="button"
                        onClick={() => toggleAttrVal(val.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs border transition ${
                          selected
                            ? "bg-[#111111] text-[#F7F4EF] border-[#111111]"
                            : "bg-white text-[#111111]/80 border-[#D8C8B5] hover:border-[#111111]"
                        }`}
                      >
                        {attr.type === "color" && val.color_hex && (
                          <span
                            className="w-3 h-3 rounded-full border border-white/40"
                            style={{ backgroundColor: val.color_hex }}
                          />
                        )}
                        <span>{val.value}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Left Column: Classification, Pricing (IQD), Stock, Badges, Status */}
        <div className="lg:col-span-4 space-y-6">
          {/* Status & Classification */}
          <div className="bg-white border border-[#D8C8B5]/70 p-6 space-y-4">
            <h2 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
              القسم والتصنيف والحالة
            </h2>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                حالة المنتج
              </label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "active" | "hidden" | "draft")
                }
                className="w-full border border-[#D8C8B5] px-3 py-2.5 text-xs bg-white"
              >
                <option value="active">نشط (يظهر في المتجر)</option>
                <option value="hidden">مخفي (محفوظ ولا يظهر للعملاء)</option>
                <option value="draft">مسودة</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                القسم <span className="text-rose-600">*</span>
              </label>
              <select
                value={genderId}
                onChange={(e) => {
                  setGenderId(Number(e.target.value));
                  setCategoryId("");
                  setSubcategoryId("");
                }}
                className="w-full border border-[#D8C8B5] px-3 py-2.5 text-xs bg-white"
              >
                {genders.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                التصنيف
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubcategoryId("");
                }}
                className="w-full border border-[#D8C8B5] px-3 py-2.5 text-xs bg-white"
              >
                <option value="">اختر التصنيف</option>
                {genderCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {subCategories.length > 0 && (
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  التصنيف الفرعي
                </label>
                <select
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  className="w-full border border-[#D8C8B5] px-3 py-2.5 text-xs bg-white"
                >
                  <option value="">بدون تصنيف فرعي</option>
                  {subCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Pricing in IQD & Stock */}
          <div className="bg-white border border-[#D8C8B5]/70 p-6 space-y-4">
            <h2 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
              التسعير (بالدينار العراقي د.ع) والمخزون
            </h2>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                السعر بالدينار العراقي (د.ع) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                step={500}
                value={priceIqd}
                onChange={(e) => setPriceIqd(e.target.value)}
                className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                السعر بعد الخصم (د.ع — اختياري)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={discountPriceIqd}
                onChange={(e) => setDiscountPriceIqd(e.target.value)}
                placeholder="اتركه فارغًا إذا لا يوجد خصم"
                className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  كمية المخزون
                </label>
                <input
                  type="number"
                  min={0}
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  حد التنبيه المنخفض
                </label>
                <input
                  type="number"
                  min={1}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Badges / Flags */}
          <div className="bg-white border border-[#D8C8B5]/70 p-6 space-y-3">
            <h2 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
              الشارات والمجموعات
            </h2>
            {[
              { label: "منتج مميز", val: isFeatured, set: setIsFeatured },
              { label: "الأكثر طلباً", val: isBestseller, set: setIsBestseller },
              { label: "وصل حديثًا", val: isNewArrival, set: setIsNewArrival },
              {
                label: "إصدار محدود",
                val: isLimitedEdition,
                set: setIsLimitedEdition,
              },
            ].map((flag) => (
              <label
                key={flag.label}
                className="flex items-center gap-2.5 text-xs font-medium cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={flag.val}
                  onChange={(e) => flag.set(e.target.checked)}
                  className="accent-[#111111] w-4 h-4"
                />
                <span>{flag.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <MediaPickerModal
        open={mediaOpen}
        defaultCategory="products"
        onSelect={(url) => {
          setImages((prev) => [
            ...prev,
            { url, alt_text: name, is_primary: prev.length === 0 },
          ]);
        }}
        onClose={() => setMediaOpen(false)}
      />
    </form>
  );
}
