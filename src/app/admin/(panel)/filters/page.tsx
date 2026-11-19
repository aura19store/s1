"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  GripVertical,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { ConfirmModal } from "@/components/admin/ConfirmModal";

interface FilterValue {
  id?: number;
  value: string;
  color_hex: string;
  usage_count?: number;
}

interface FilterRow {
  id: number;
  slug: string;
  name: string;
  type: "color" | "select" | "size" | "text";
  sort_order: number;
  is_visible: number;
  values: FilterValue[];
}

const FILTER_TYPE_LABELS: Record<string, string> = {
  color: "ألوان (مع مربع لون)",
  select: "قائمة خيارات",
  size: "مقاسات",
  text: "خاصية مخصصة",
};

export default function AdminFiltersPage() {
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);
  const [notice, setNotice] = useState("");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const reorderPending = useRef(false);
  const [reorderError, setReorderError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FilterRow | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"color" | "select" | "size" | "text">("select");
  const [formVisible, setFormVisible] = useState(true);
  const [formValues, setFormValues] = useState<FilterValue[]>([]);
  const [newOptionText, setNewOptionText] = useState("");
  const [newOptionHex, setNewOptionHex] = useState("#B79B6C");
  const [saving, setSaving] = useState(false);
  const savePending = useRef(false);
  const pendingChanges = useRef(new Set<number>());

  const [deleteTarget, setDeleteTarget] = useState<FilterRow | null>(null);
  const pendingDeletes = useRef(new Set<number>());
  const filtersRevision = useRef(0);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3200);
  };

  const loadFilters = useCallback(async () => {
    const revision = filtersRevision.current;
    if (!hasLoaded.current) setLoading(true);
    try {
      const res = await fetch("/api/admin/filters", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (revision === filtersRevision.current) {
          setFilters((data.filters || []).filter((item: FilterRow) => !pendingDeletes.current.has(item.id)));
        }
      }
    } catch {
      setNotice("تعذر تحميل الفلاتر، يرجى التحقق من الاتصال.");
    } finally {
      hasLoaded.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  const openCreate = () => {
    setEditing(null);
    setFormName("");
    setFormType("select");
    setFormVisible(true);
    setFormValues([]);
    setNewOptionText("");
    setModalOpen(true);
  };

  const openEdit = (f: FilterRow) => {
    setEditing(f);
    setFormName(f.name);
    setFormType(f.type);
    setFormVisible(Boolean(f.is_visible));
    setFormValues(f.values.map((v) => ({ ...v })));
    setNewOptionText("");
    setModalOpen(true);
  };

  const addOption = () => {
    if (!newOptionText.trim()) return;
    setFormValues((prev) => [
      ...prev,
      {
        value: newOptionText.trim(),
        color_hex: formType === "color" ? newOptionHex : "",
      },
    ]);
    setNewOptionText("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savePending.current || reorderPending.current || pendingDeletes.current.size || (editing && pendingChanges.current.has(editing.id))) return;
    savePending.current = true; setSaving(true); setNotice("");
    if (editing) pendingChanges.current.add(editing.id);
    const payload = { name: formName, type: formType, is_visible: formVisible,
      values: formValues.map(v => ({ id: v.id, value: v.value, color_hex: formType === "color" ? v.color_hex : "" })) };
    try {
      const res = await fetch(editing ? `/api/admin/filters/${editing.id}` : "/api/admin/filters", {
        method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.filter?.id) throw new Error(data.error || "تعذر تأكيد حفظ الفلتر.");
      filtersRevision.current += 1;
      setFilters(list => [...list.filter(item => item.id !== Number(data.filter.id)), data.filter].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
      setModalOpen(false); flash(data.message || "تم حفظ الفلتر بنجاح.");
    } catch (error) { flash(error instanceof Error ? error.message : "تعذر الاتصال لحفظ الفلتر."); }
    finally { if (editing) pendingChanges.current.delete(editing.id); savePending.current = false; setSaving(false); }
  };

  const toggleVisible = async (f: FilterRow) => {
    if (pendingChanges.current.has(f.id) || pendingDeletes.current.has(f.id) || reorderPending.current || savePending.current) return;
    pendingChanges.current.add(f.id); filtersRevision.current += 1;
    setFilters(list => list.map(item => item.id === f.id ? { ...item, is_visible: f.is_visible ? 0 : 1 } : item));
    try {
      const res = await fetch(`/api/admin/filters/${f.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_visible: !f.is_visible }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذر تغيير ظهور الفلتر.");
      if (data.filter?.id) setFilters(list => list.map(item => item.id === f.id ? data.filter : item));
      flash(f.is_visible ? "تم إخفاء الفلتر." : "تم إظهار الفلتر.");
    } catch (error) {
      setFilters(list => list.map(item => item.id === f.id ? f : item));
      flash(error instanceof Error ? error.message : "تعذر تأكيد التغيير.");
    } finally { filtersRevision.current += 1; pendingChanges.current.delete(f.id); }
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target || pendingDeletes.current.has(target.id) || pendingChanges.current.has(target.id) || reorderPending.current || savePending.current) return;
    pendingDeletes.current.add(target.id);
    filtersRevision.current += 1;
    setDeleteTarget(null);
    setFilters((previous) => previous.filter((item) => item.id !== target.id));
    try {
      const res = await fetch(`/api/admin/filters/${target.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذر حذف الفلتر.");
      flash(data.message || "تم حذف الفلتر بنجاح.");
    } catch (error) {
      setFilters((previous) => previous.some((item) => item.id === target.id)
        ? previous
        : [...previous, target].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
      flash(error instanceof Error ? error.message : "تعذر حذف الفلتر.");
    } finally {
      filtersRevision.current += 1;
      pendingDeletes.current.delete(target.id);
    }
  };

  const handleDrop = async (targetId: number) => {
    if (reorderPending.current || pendingDeletes.current.size > 0 || pendingChanges.current.size > 0 || savePending.current || draggedId === null || draggedId === targetId) return;
    const previous = filters;
    const list = [...filters];
    const fromIdx = list.findIndex((f) => f.id === draggedId);
    const toIdx = list.findIndex((f) => f.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setDraggedId(null);
    setFilters(list);
    reorderPending.current = true;
    setNotice("");
    setReorderError("");
    try {
      const res = await fetch("/api/admin/filters/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: list.map((f) => f.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFilters(previous);
        setReorderError(data.error || "تعذر حفظ ترتيب الفلاتر.");
      } else {
        flash(data.message || "تم تحديث ترتيب الفلاتر.");
      }
    } catch {
      setFilters(previous);
      setReorderError("تعذر الاتصال لحفظ ترتيب الفلاتر.");
    } finally {
      reorderPending.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl text-[#111111]">
            إدارة الفلاتر والخصائص
          </h1>
          <p className="text-xs text-[#111111]/60 mt-1">
            تحكم بالألوان والخامات والمقاسات وأي فلاتر مخصصة — ترتبط تلقائيًا بالمنتجات والمتجر
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111] transition"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة فلتر جديد</span>
        </button>
      </div>

      {reorderError && <p role="alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm">{reorderError}</p>}
      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
          <span>جاري تحميل الفلاتر...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {filters.map((f) => (
            <div
              key={f.id}
              draggable
              onDragStart={() => setDraggedId(f.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(f.id)}
              className="bg-white border border-[#D8C8B5]/70 p-5 space-y-4 cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <GripVertical className="w-5 h-5 text-[#111111]/35" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-[#111111]">
                        {f.name}
                      </h2>
                      <span className="text-[11px] px-2 py-0.5 bg-[#EFEAE2] text-[#111111]/75">
                        {FILTER_TYPE_LABELS[f.type] || f.type}
                      </span>
                      {!f.is_visible && (
                        <span className="text-[11px] px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-300">
                          مخفي
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(f)}
                    title="تعديل الفلتر وخياراته"
                    className="p-2 border border-[#D8C8B5] hover:border-[#111111]"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVisible(f)}
                    title={f.is_visible ? "إخفاء" : "إظهار"}
                    className="p-2 border border-[#D8C8B5] hover:border-[#111111]"
                  >
                    {f.is_visible ? (
                      <EyeOff className="w-4 h-4 text-amber-700" />
                    ) : (
                      <Eye className="w-4 h-4 text-emerald-700" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(f)}
                    title="حذف الفلتر"
                    className="p-2 border border-rose-200 hover:bg-rose-50 text-rose-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pr-8">
                {f.values.map((v, idx) => (
                  <span
                    key={v.id || idx}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-[#F7F4EF] border border-[#D8C8B5]/80 text-xs"
                  >
                    {f.type === "color" && v.color_hex && (
                      <span
                        className="w-3 h-3 rounded-full border border-black/20"
                        style={{ backgroundColor: v.color_hex }}
                      />
                    )}
                    <span>{v.value}</span>
                    <span className="text-[10px] text-[#111111]/45">
                      ({v.usage_count ?? 0})
                    </span>
                  </span>
                ))}
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
              <h2 className="text-base font-bold text-[#111111]">
                {editing ? "تعديل الفلتر" : "إنشاء فلتر جديد"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  اسم الفلتر <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: اللون، الخامة، النمط..."
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  نوع العرض
                </label>
                <select
                  value={formType}
                  onChange={(e) =>
                    setFormType(
                      e.target.value as "color" | "select" | "size" | "text"
                    )
                  }
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm bg-white"
                >
                  <option value="select">قائمة خيارات</option>
                  <option value="color">ألوان (مع مربع لون)</option>
                  <option value="size">مقاسات</option>
                  <option value="text">خاصية مخصصة</option>
                </select>
              </div>
            </div>

            {/* Add Option Input */}
            <div className="pt-2">
              <label className="block text-xs font-semibold mb-1.5">
                خيارات الفلتر
              </label>
              <div className="flex items-center gap-2">
                {formType === "color" && (
                  <input
                    type="color"
                    value={newOptionHex}
                    onChange={(e) => setNewOptionHex(e.target.value)}
                    className="w-10 h-10 border border-[#D8C8B5] p-0.5 cursor-pointer"
                  />
                )}
                <input
                  type="text"
                  value={newOptionText}
                  onChange={(e) => setNewOptionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  placeholder="أكتب اسم الخيار ثم اضغط إضافة..."
                  className="flex-1 border border-[#D8C8B5] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="px-4 py-2 bg-[#EFEAE2] hover:bg-[#D8C8B5] text-xs font-semibold"
                >
                  إضافة
                </button>
              </div>

              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                {formValues.map((val, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-2 bg-[#F7F4EF] border border-[#D8C8B5]/60 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {formType === "color" && (
                        <input
                          type="color"
                          value={val.color_hex || "#111111"}
                          onChange={(e) =>
                            setFormValues((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, color_hex: e.target.value }
                                  : item
                              )
                            )
                          }
                          className="w-6 h-6 border border-[#D8C8B5]"
                        />
                      )}
                      <input
                        type="text"
                        value={val.value}
                        onChange={(e) =>
                          setFormValues((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? { ...item, value: e.target.value }
                                : item
                            )
                          )
                        }
                        className="bg-transparent font-medium focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFormValues((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="text-rose-700 hover:text-rose-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={formVisible}
                onChange={(e) => setFormVisible(e.target.checked)}
                className="accent-[#111111] w-4 h-4"
              />
              <span>إظهار الفلتر في المتجر</span>
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D8C8B5]/50">
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
                {saving ? "جاري الحفظ..." : "حفظ الفلتر"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="تأكيد حذف الفلتر"
        message={`هل أنت متأكد من حذف الفلتر "${deleteTarget?.name || ""}" وجميع خياراته؟`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
