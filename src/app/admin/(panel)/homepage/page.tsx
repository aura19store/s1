"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  GripVertical,
  Eye,
  EyeOff,
  Edit3,
  Check,
  X,
  Image as ImageIcon,
  Loader2,
  Save,
} from "lucide-react";
import { SECTION_TYPE_LABELS } from "@/lib/constants";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";

interface SectionRow {
  id: number;
  section_key: string;
  gender_slug: string;
  type: string;
  title: string;
  subtitle: string;
  description: string;
  cta_text: string;
  cta_link: string;
  image_url: string;
  secondary_title: string;
  secondary_subtitle: string;
  secondary_cta_text: string;
  secondary_cta_link: string;
  secondary_image_url: string;
  sort_order: number;
  is_visible: number;
}

interface GenderRow {
  id: number;
  slug: string;
  name: string;
  entry_title: string;
  entry_subtitle: string;
  entry_image: string;
}

export default function AdminHomepageBuilderPage() {
  const [activeTab, setActiveTab] = useState<"men" | "women" | "entry">("men");
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [genders, setGenders] = useState<GenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const reorderPending = useRef(false);
  const [reorderError, setReorderError] = useState("");

  // Edit Section Modal
  const [editing, setEditing] = useState<SectionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<
    null | "primary" | "secondary" | { genderId: number }
  >(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3200);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const gParam = activeTab === "women" ? "women" : "men";
    try {
      const res = await fetch(`/api/admin/homepage?gender=${gParam}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setSections(data.sections || []);
        setGenders(data.genders || []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleVisible = async (sec: SectionRow) => {
    const res = await fetch("/api/admin/homepage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sec.id, is_visible: !sec.is_visible }),
    });
    if (res.ok) {
      flash(sec.is_visible ? "تم إخفاء القسم." : "تم إظهار القسم في الصفحة الرئيسية.");
      loadData();
    }
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const res = await fetch("/api/admin/homepage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editing,
        is_visible: Boolean(editing.is_visible),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setEditing(null);
      flash(data.message || "تم حفظ تعديلات القسم.");
      loadData();
    }
  };

  const handleSaveEntryGender = async (g: GenderRow) => {
    setSaving(true);
    const res = await fetch("/api/admin/homepage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "gender_entry",
        id: g.id,
        entry_title: g.entry_title,
        entry_subtitle: g.entry_subtitle,
        entry_image: g.entry_image,
      }),
    });
    setSaving(false);
    if (res.ok) {
      flash(`تم تحديث بطاقة دخول "${g.name}" بنجاح.`);
      loadData();
    }
  };

  const handleDrop = async (targetId: number) => {
    if (reorderPending.current || draggedId === null || draggedId === targetId) return;
    const previous = sections;
    const list = [...sections];
    const fromIdx = list.findIndex((s) => s.id === draggedId);
    const toIdx = list.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    setDraggedId(null);
    setSections(list);
    reorderPending.current = true;
    setNotice("");
    setReorderError("");
    try {
      const res = await fetch("/api/admin/homepage/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: list.map((s) => s.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSections(previous);
        setReorderError(data.error || "تعذر حفظ ترتيب أقسام الصفحة الرئيسية.");
      } else {
        flash(data.message || "تم تحديث ترتيب أقسام الصفحة الرئيسية بنجاح.");
      }
    } catch {
      setSections(previous);
      setReorderError("تعذر الاتصال لحفظ ترتيب أقسام الصفحة الرئيسية.");
    } finally {
      reorderPending.current = false;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-editorial text-3xl text-[#111111]">
          منشئ الصفحة الرئيسية والواجهات
        </h1>
        <p className="text-xs text-[#111111]/60 mt-1">
          تحكم كامل بترتيب وإظهار وتعديل أقسام الواجهة الرئيسية وقصة العلامة والبانرات لكل من الرجالي والنسائي بدون مبرمج
        </p>
      </div>

      {reorderError && <p role="alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm">{reorderError}</p>}
      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#D8C8B5]">
        {[
          { key: "men", label: "الصفحة الرئيسية — الرجالي" },
          { key: "women", label: "الصفحة الرئيسية — النسائي" },
          { key: "entry", label: "شاشة الدخول (اختر هالتك)" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as "men" | "women" | "entry")}
            className={`px-5 py-3 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === tab.key
                ? "border-[#111111] text-[#111111] bg-white"
                : "border-transparent text-[#111111]/60 hover:text-[#111111]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
          <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
          <span>جاري تحميل الأقسام...</span>
        </div>
      ) : activeTab === "entry" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {genders.map((g) => (
            <div
              key={g.id}
              className="bg-white border border-[#D8C8B5]/80 p-6 space-y-4"
            >
              <h2 className="text-base font-bold text-[#111111] pb-2 border-b border-[#D8C8B5]/50">
                بطاقة القسم: {g.name}
              </h2>
              <div className="aspect-[16/10] bg-[#EFEAE2] overflow-hidden relative">
                <img
                  src={g.entry_image}
                  alt={g.entry_title}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => setMediaTarget({ genderId: g.id })}
                  className="absolute bottom-3 left-3 px-3 py-1.5 bg-[#111111]/90 text-[#F7F4EF] text-xs font-medium flex items-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>تغيير الصورة</span>
                </button>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  العنوان الظاهر
                </label>
                <input
                  type="text"
                  value={g.entry_title}
                  onChange={(e) =>
                    setGenders((prev) =>
                      prev.map((item) =>
                        item.id === g.id
                          ? { ...item, entry_title: e.target.value }
                          : item
                      )
                    )
                  }
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  الوصف المختصر
                </label>
                <input
                  type="text"
                  value={g.entry_subtitle}
                  onChange={(e) =>
                    setGenders((prev) =>
                      prev.map((item) =>
                        item.id === g.id
                          ? { ...item, entry_subtitle: e.target.value }
                          : item
                      )
                    )
                  }
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveEntryGender(g)}
                className="px-5 py-2.5 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111] flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[#111111]/60">
            اسحب وأفلت البطاقات لإعادة ترتيب ظهور الأقسام في المتجر:
          </p>
          {sections.map((sec, idx) => (
            <div
              key={sec.id}
              draggable
              onDragStart={() => setDraggedId(sec.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(sec.id)}
              className="bg-white border border-[#D8C8B5]/70 p-4 flex items-center justify-between gap-4 cursor-grab active:cursor-grabbing hover:border-[#111111]/50 transition"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <GripVertical className="w-5 h-5 text-[#111111]/35 shrink-0" />
                <span className="w-6 text-center text-xs font-bold text-[#B79B6C]">
                  {idx + 1}
                </span>
                {sec.image_url && (
                  <img
                    src={sec.image_url}
                    alt={sec.title}
                    className="w-16 h-11 object-cover border border-[#D8C8B5] shrink-0 hidden sm:block"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 bg-[#EFEAE2] text-[#111111] font-semibold">
                      {SECTION_TYPE_LABELS[sec.type] || sec.type}
                    </span>
                    <h3 className="text-sm font-bold text-[#111111] truncate">
                      {sec.title}
                    </h3>
                    {!sec.is_visible && (
                      <span className="text-[10px] px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-300">
                        مخفي
                      </span>
                    )}
                  </div>
                  {sec.subtitle && (
                    <p className="text-xs text-[#111111]/60 truncate mt-0.5">
                      {sec.subtitle}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing({ ...sec })}
                  className="px-3 py-2 border border-[#D8C8B5] hover:border-[#111111] text-xs font-medium flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleVisible(sec)}
                  title={sec.is_visible ? "إخفاء القسم" : "إظهار القسم"}
                  className="p-2 border border-[#D8C8B5] hover:border-[#111111]"
                >
                  {sec.is_visible ? (
                    <EyeOff className="w-4 h-4 text-amber-700" />
                  ) : (
                    <Eye className="w-4 h-4 text-emerald-700" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Section Editor Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#111111]/60 backdrop-blur-xs"
            onClick={() => setEditing(null)}
          />
          <form
            onSubmit={handleSaveSection}
            className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-[#D8C8B5] p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#D8C8B5]/60">
              <h2 className="text-base font-bold text-[#111111]">
                تعديل: {SECTION_TYPE_LABELS[editing.type] || editing.title}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  العنوان الرئيسي
                </label>
                <input
                  type="text"
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  العنوان الفرعي
                </label>
                <input
                  type="text"
                  value={editing.subtitle}
                  onChange={(e) =>
                    setEditing({ ...editing, subtitle: e.target.value })
                  }
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                />
              </div>

              {(editing.type === "hero" || editing.type === "story") && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5">
                    الوصف / النص التفصيلي
                  </label>
                  <textarea
                    rows={3}
                    value={editing.description}
                    onChange={(e) =>
                      setEditing({ ...editing, description: e.target.value })
                    }
                    className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  نص الزر
                </label>
                <input
                  type="text"
                  value={editing.cta_text}
                  onChange={(e) =>
                    setEditing({ ...editing, cta_text: e.target.value })
                  }
                  className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5">
                  رابط الزر
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={editing.cta_link}
                  onChange={(e) =>
                    setEditing({ ...editing, cta_link: e.target.value })
                  }
                  className="w-full text-right border border-[#D8C8B5] px-3 py-2 text-sm"
                />
              </div>

              {(editing.type === "hero" ||
                editing.type === "story" ||
                editing.type === "promo_split") && (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5">
                    {editing.type === "promo_split"
                      ? "صورة البطاقة الأولى (الرجالي)"
                      : "الصورة"}
                  </label>
                  <div className="flex items-center gap-3">
                    {editing.image_url && (
                      <img
                        src={editing.image_url}
                        alt="معاينة"
                        className="w-24 h-16 object-cover border border-[#D8C8B5]"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setMediaTarget("primary")}
                      className="px-4 py-2 bg-[#EFEAE2] hover:bg-[#D8C8B5] text-xs font-semibold flex items-center gap-2"
                    >
                      <ImageIcon className="w-4 h-4" />
                      <span>اختيار أو رفع صورة</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Promo Split Second Card (Women) */}
              {editing.type === "promo_split" && (
                <>
                  <div className="sm:col-span-2 pt-3 border-t border-[#D8C8B5]/60">
                    <p className="text-xs font-bold text-[#B79B6C]">
                      البطاقة الثانية (القسم النسائي)
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      العنوان
                    </label>
                    <input
                      type="text"
                      value={editing.secondary_title}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          secondary_title: e.target.value,
                        })
                      }
                      className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      الوصف
                    </label>
                    <input
                      type="text"
                      value={editing.secondary_subtitle}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          secondary_subtitle: e.target.value,
                        })
                      }
                      className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      نص الزر الثاني
                    </label>
                    <input
                      type="text"
                      value={editing.secondary_cta_text}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          secondary_cta_text: e.target.value,
                        })
                      }
                      className="w-full border border-[#D8C8B5] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">
                      رابط الزر الثاني
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={editing.secondary_cta_link}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          secondary_cta_link: e.target.value,
                        })
                      }
                      className="w-full text-right border border-[#D8C8B5] px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold mb-1.5">
                      صورة البطاقة الثانية
                    </label>
                    <div className="flex items-center gap-3">
                      {editing.secondary_image_url && (
                        <img
                          src={editing.secondary_image_url}
                          alt="معاينة"
                          className="w-24 h-16 object-cover border border-[#D8C8B5]"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setMediaTarget("secondary")}
                        className="px-4 py-2 bg-[#EFEAE2] hover:bg-[#D8C8B5] text-xs font-semibold flex items-center gap-2"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span>اختيار أو رفع صورة</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D8C8B5]/60">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-5 py-2.5 border border-[#D8C8B5] text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#111111] text-[#F7F4EF] text-xs font-semibold hover:bg-[#B79B6C] hover:text-[#111111]"
              >
                {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </form>
        </div>
      )}

      <MediaPickerModal
        open={Boolean(mediaTarget)}
        defaultCategory="hero"
        onSelect={(url) => {
          if (mediaTarget === "primary" && editing) {
            setEditing({ ...editing, image_url: url });
          } else if (mediaTarget === "secondary" && editing) {
            setEditing({ ...editing, secondary_image_url: url });
          } else if (
            mediaTarget &&
            typeof mediaTarget === "object" &&
            "genderId" in mediaTarget
          ) {
            setGenders((prev) =>
              prev.map((g) =>
                g.id === mediaTarget.genderId ? { ...g, entry_image: url } : g
              )
            );
          }
          setMediaTarget(null);
        }}
        onClose={() => setMediaTarget(null)}
      />
    </div>
  );
}
