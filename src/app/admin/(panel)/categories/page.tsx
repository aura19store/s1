"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  GripVertical,
  Eye,
  EyeOff,
  Edit3,
  Trash2,
  Image as ImageIcon,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";

interface CategoryRow {
  id: number;
  gender_id: number;
  gender_name: string;
  gender_slug: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  sort_order: number;
  is_visible: number;
  product_count: number;
}

export default function AdminCategoriesPage() {
  const [genders, setGenders] = useState<
    { id: number; slug: string; name: string }[]
  >([]);
  const [activeGenderId, setActiveGenderId] = useState<number>(0);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [draggedId, setDraggedId] = useState<number | null>(null);

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [formGenderId, setFormGenderId] = useState<number>(1);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formImage, setFormImage] = useState("/images/brand-story.jpg");
  const [formVisible, setFormVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const listRevision = useRef(0);
  const [saveError, setSaveError] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);

  // Delete Modal
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3200);
  };

  const loadData = useCallback(async () => {
    const revision = listRevision.current;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setGenders(data.genders || []);
        if (revision === listRevision.current) setCategories(data.categories || []);
        if (data.genders?.[0]) {
          setActiveGenderId((current) => current || data.genders[0].id);
        }
      }
    } catch {
      setNotice("تعذر تحميل التصنيفات، يرجى التحقق من الاتصال.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentList = categories.filter((c) => c.gender_id === activeGenderId);

  const openCreate = () => {
    setSaveError("");
    setEditing(null);
    setFormGenderId(activeGenderId || genders[0]?.id || 1);
    setFormName("");
    setFormDesc("");
    setFormImage("/images/brand-story.jpg");
    setFormVisible(true);
    setModalOpen(true);
  };

  const openEdit = (cat: CategoryRow) => {
    setSaveError("");
    setEditing(cat);
    setFormGenderId(cat.gender_id);
    setFormName(cat.name);
    setFormDesc(cat.description || "");
    setFormImage(cat.image_url || "/images/brand-story.jpg");
    setFormVisible(Boolean(cat.is_visible));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    const payload = {
      gender_id: Number(formGenderId),
      name: formName,
      description: formDesc,
      image_url: formImage,
      is_visible: formVisible,
    };
    const url = editing
      ? `/api/admin/categories/${editing.id}`
      : "/api/admin/categories";
    try {
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data.error || `تعذر حفظ التصنيف (${res.status}).`);
        return;
      }
      const gender = genders.find((g) => g.id === payload.gender_id);
      if (!gender || (!editing && !data.category)) {
        // The write succeeded, but the response cannot safely populate the list.
        setModalOpen(false);
        flash(data.message || "تم حفظ التصنيف بنجاح.");
        await loadData();
        return;
      }
      listRevision.current += 1;
      setCategories((previous) => editing
        ? previous.map((category) => category.id === editing.id
          ? { ...category, gender_id: payload.gender_id, gender_name: gender!.name,
              gender_slug: gender!.slug, name: payload.name.trim(), description: payload.description.trim(),
              image_url: payload.image_url.trim(), is_visible: Number(payload.is_visible) }
          : category)
        : [...previous, { ...data.category, gender_name: gender!.name, gender_slug: gender!.slug }]);
      setActiveGenderId(payload.gender_id);
      setModalOpen(false);
      flash(data.message || "تم حفظ التصنيف بنجاح.");
    } catch {
      setSaveError("تعذر الاتصال بالخادم. تحقق من القائمة قبل إعادة المحاولة للتأكد من عدم حفظ التصنيف.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const toggleVisible = async (cat: CategoryRow) => {
    const res = await fetch(`/api/admin/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_visible: !cat.is_visible }),
    });
    if (res.ok) {
      flash(
        cat.is_visible
          ? "تم إخفاء التصنيف من المتجر."
          : "تم إظهار التصنيف في المتجر."
      );
      listRevision.current += 1;
      setCategories((previous) => previous.map((category) => category.id === cat.id ? { ...category, is_visible: Number(!cat.is_visible) } : category));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/categories/${deleteTarget.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setDeleting(false);
    setDeleteTarget(null);
    if (res.ok) {
      flash(data.message || "تم حذف التصنيف بنجاح.");
      listRevision.current += 1;
      setCategories((previous) => previous.filter((category) => category.id !== deleteTarget.id));
    }
  };

  // Drag & Drop Reordering
  const persistOrder = async (reordered: CategoryRow[]) => {
    const otherCats = categories.filter((c) => c.gender_id !== activeGenderId);
    setCategories([...otherCats, ...reordered]);
    const res = await fetch("/api/admin/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((c) => c.id) }),
    });
    if (res.ok) {
      flash("تم تحديث ترتيب دوائر التصنيفات في المتجر مباشرة.");
    }
  };

  const handleDrop = (targetId: number) => {
    if (draggedId === null || draggedId === targetId) return;
    const list = [...currentList];
    const fromIdx = list.findIndex((c) => c.id === draggedId);
    const toIdx = list.findIndex((c) => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setDraggedId(null);
    persistOrder(list);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl text-[#111111]">
            إدارة التصنيفات
          </h1>
          <p className="text-xs text-[#111111]/60 mt-1">
            اسحب وأفلت التصنيفات لإعادة ترتيب الدوائر في واجهة المتجر مباشرة
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111] transition"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء تصنيف جديد</span>
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Gender Tabs: الرجالي | النسائي */}
      <div className="flex items-center gap-2 border-b border-[#D8C8B5]">
        {genders.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setActiveGenderId(g.id)}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition ${
              activeGenderId === g.id
                ? "border-[#111111] text-[#111111] bg-white"
                : "border-transparent text-[#111111]/60 hover:text-[#111111]"
            }`}
          >
            {g.slug === "women" ? "النسائي" : g.slug === "men" ? "الرجالي" : g.name} (
            {categories.filter((c) => c.gender_id === g.id).length})
          </button>
        ))}
      </div>

      {/* Draggable List */}
      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
          <span>جاري تحميل التصنيفات...</span>
        </div>
      ) : currentList.length === 0 ? (
        <div className="bg-white border border-[#D8C8B5] p-12 text-center text-sm text-[#111111]/60">
          لا توجد تصنيفات في هذا القسم بعد.
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentList.map((cat, idx) => (
            <div
              key={cat.id}
              draggable
              onDragStart={() => setDraggedId(cat.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(cat.id)}
              className={`bg-white border p-4 flex items-center justify-between gap-4 cursor-grab active:cursor-grabbing transition ${
                draggedId === cat.id
                  ? "border-[#B79B6C] opacity-60"
                  : "border-[#D8C8B5]/70 hover:border-[#111111]/50"
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <GripVertical className="w-5 h-5 text-[#111111]/35 shrink-0" />
                <span className="w-6 text-center text-xs font-bold text-[#B79B6C]">
                  {idx + 1}
                </span>
                <img
                  src={cat.image_url || "/images/brand-story.jpg"}
                  alt={cat.name}
                  className="w-12 h-12 rounded-full object-cover border border-[#D8C8B5] shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#111111]">
                      {cat.name}
                    </p>
                    {!cat.is_visible && (
                      <span className="px-2 py-0.5 text-[10px] bg-stone-100 text-stone-600 border border-stone-300">
                        مخفي
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#111111]/60 truncate max-w-md">
                    {cat.description || "بدون وصف"} • {cat.product_count} منتج
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(cat)}
                  title="تعديل التصنيف"
                  className="p-2 border border-[#D8C8B5] hover:border-[#111111]"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => toggleVisible(cat)}
                  title={cat.is_visible ? "إخفاء التصنيف" : "إظهار التصنيف"}
                  className="p-2 border border-[#D8C8B5] hover:border-[#111111]"
                >
                  {cat.is_visible ? (
                    <EyeOff className="w-4 h-4 text-amber-700" />
                  ) : (
                    <Eye className="w-4 h-4 text-emerald-700" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(cat)}
                  title="حذف التصنيف"
                  className="p-2 border border-rose-200 hover:bg-rose-50 text-rose-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#111111]/60 backdrop-blur-xs"
            onClick={() => { if (!savingRef.current) setModalOpen(false); }}
          />
          <form
            onSubmit={handleSave}
            className="relative z-10 w-full max-w-lg bg-white border border-[#D8C8B5] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D8C8B5]/60">
              <h2 className="text-base font-bold text-[#111111]">
                {editing ? "تعديل التصنيف" : "إنشاء تصنيف جديد"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">القسم</label>
              <select
                value={formGenderId}
                onChange={(e) => setFormGenderId(Number(e.target.value))}
                className="w-full border border-[#D8C8B5] px-3 py-2.5 text-sm bg-white"
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
                اسم التصنيف <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="مثال: حقائب، ساعات، خواتم..."
                className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                الوصف
              </label>
              <textarea
                rows={2}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="وصف مختصر يظهر في صفحة التصنيف..."
                className="w-full border border-[#D8C8B5] px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                صورة التصنيف (الدائرة)
              </label>
              <div className="flex items-center gap-3">
                <img
                  src={formImage || "/images/brand-story.jpg"}
                  alt="معاينة"
                  className="w-16 h-16 rounded-full object-cover border border-[#D8C8B5]"
                />
                <button
                  type="button"
                  onClick={() => setMediaOpen(true)}
                  className="px-4 py-2.5 bg-[#EFEAE2] hover:bg-[#D8C8B5] text-xs font-semibold flex items-center gap-2"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>اختيار أو رفع صورة</span>
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={formVisible}
                onChange={(e) => setFormVisible(e.target.checked)}
                className="accent-[#111111] w-4 h-4"
              />
              <span>إظهار التصنيف في واجهة المتجر</span>
            </label>

            {saveError && <p role="alert" className="text-xs text-rose-700">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-3 border-t border-[#D8C8B5]/50">
              <button
                type="button"
                disabled={saving}
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
                {saving ? "جاري الحفظ..." : "حفظ التصنيف"}
              </button>
            </div>
          </form>
        </div>
      )}

      <MediaPickerModal
        open={mediaOpen}
        defaultCategory="categories"
        onSelect={(url) => setFormImage(url)}
        onClose={() => setMediaOpen(false)}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="تأكيد حذف التصنيف"
        message={`هل تريد حذف التصنيف "${deleteTarget?.name || ""}"؟ في حال وجود منتجات مرتبطة به سيتم فك ارتباطها بأمان دون حذف أي منتج.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
