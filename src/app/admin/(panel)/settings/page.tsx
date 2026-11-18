"use client";

import React, { useEffect, useState } from "react";
import { Save, Check, Plus, Trash2, Lock, Loader2, AlertCircle, Image as ImageIcon } from "lucide-react";
import type { FaqItem, PaymentMethodConfig, StoreSettings } from "@/lib/store-queries";
import { MediaPickerModal } from "@/components/admin/MediaPickerModal";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setSettings(data.settings);
      })
      .catch(() => setError("تعذر الاتصال لتحميل الإعدادات."))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذر حفظ الإعدادات.");
      } else {
        setSettings(data.settings);
        setNotice(data.message || "تم حفظ إعدادات المتجر بنجاح.");
        setTimeout(() => setNotice(""), 3200);
      }
    } catch {
      setError("تعذر الاتصال لحفظ الإعدادات.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
        <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
        <span>جاري تحميل الإعدادات...</span>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        <span>{error || "ليس لديك صلاحية للوصول إلى الإعدادات."}</span>
      </div>
    );
  }

  const updatePayment = (idx: number, patch: Partial<PaymentMethodConfig>) => {
    const next = [...settings.payment_methods];
    next[idx] = { ...next[idx], ...patch };
    setSettings({ ...settings, payment_methods: next });
  };

  const updateFaq = (idx: number, patch: Partial<FaqItem>) => {
    const next = [...settings.faqs];
    next[idx] = { ...next[idx], ...patch };
    setSettings({ ...settings, faqs: next });
  };

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl text-[#111111]">
            إعدادات المتجر
          </h1>
          <p className="text-xs text-[#111111]/60 mt-1">
            التحكم بهوية المتجر، الشحن، طرق الدفع، معلومات التواصل، والسياسات العامة
          </p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-[#111111] text-[#F7F4EF] hover:bg-[#B79B6C] hover:text-[#111111] text-xs font-semibold flex items-center justify-center gap-2 transition"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saving ? "جاري الحفظ..." : "حفظ الإعدادات"}</span>
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          {error}
        </div>
      )}

      {/* Brand Identity & Locked Currency */}
      <section className="bg-white border border-[#D8C8B5]/80 p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
          هوية المتجر والعملة
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              اسم المتجر
            </label>
            <input
              type="text"
              value={settings.store_name}
              onChange={(e) =>
                setSettings({ ...settings, store_name: e.target.value })
              }
              className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              الشعار العربي الأساسي
            </label>
            <input
              type="text"
              value={settings.tagline}
              onChange={(e) =>
                setSettings({ ...settings, tagline: e.target.value })
              }
              className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1.5">
              العبارة الثانوية
            </label>
            <input
              type="text"
              value={settings.secondary_tagline}
              onChange={(e) =>
                setSettings({ ...settings, secondary_tagline: e.target.value })
              }
              className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1.5">
              صورة الشعار (اختياري — يُعرض شعار AURA النصي الفاخر عند تركه فارغًا)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {settings.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt="شعار المتجر"
                  className="h-12 w-auto max-w-[160px] object-contain border border-[#D8C8B5] bg-[#F7F4EF] p-1"
                />
              ) : (
                <div className="h-12 px-5 border border-[#D8C8B5] bg-[#111111] text-[#F7F4EF] flex items-center justify-center font-brand tracking-[0.26em] text-lg">
                  {settings.store_name || "AURA"}
                </div>
              )}
              <button
                type="button"
                onClick={() => setLogoPickerOpen(true)}
                className="px-4 py-2 border border-[#D8C8B5] hover:border-[#111111] text-xs font-semibold flex items-center gap-1.5"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>اختيار صورة للشعار</span>
              </button>
              {settings.logo_url && (
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, logo_url: "" })}
                  className="px-3 py-2 text-xs text-rose-700 hover:underline"
                >
                  استخدام الشعار النصي
                </button>
              )}
            </div>
          </div>

          {/* Locked Currency — IQD ONLY */}
          <div className="sm:col-span-2 bg-[#F7F4EF] border border-[#D8C8B5] p-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-[#111111]">
                العملة المعتمدة: الدينار العراقي (د.ع)
              </p>
              <p className="text-[11px] text-[#111111]/65">
                المتجر مخصص حاليًا للعراق فقط بعملة الدينار العراقي الثابتة ولا
                تتوفر خيارات عملات أخرى في هذا الإصدار.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] text-[#B79B6C] text-xs font-semibold shrink-0">
              <Lock className="w-3.5 h-3.5" />
              <span>د.ع فقط</span>
            </span>
          </div>
        </div>
      </section>

      {/* Shipping & Payment Methods */}
      <section className="bg-white border border-[#D8C8B5]/80 p-6 space-y-5">
        <h2 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
          إعدادات الشحن وطرق الدفع
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              الحد الأدنى للشحن المجاني (د.ع)
            </label>
            <input
              type="number"
              min={0}
              step={1000}
              value={settings.free_shipping_threshold_iqd}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  free_shipping_threshold_iqd: Number(e.target.value),
                })
              }
              className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              رسوم الشحن القياسية (د.ع)
            </label>
            <input
              type="number"
              min={0}
              step={500}
              value={settings.shipping_fee_iqd}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  shipping_fee_iqd: Number(e.target.value),
                })
              }
              className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
            />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <p className="text-xs font-semibold text-[#111111]">
            طرق الدفع المتاحة في صفحة إتمام الطلب
          </p>
          {settings.payment_methods.map((pm, idx) => (
            <div
              key={pm.id}
              className="flex items-start justify-between gap-4 p-3.5 bg-[#F7F4EF]/70 border border-[#D8C8B5]/70"
            >
              <div className="space-y-1 flex-1">
                <input
                  type="text"
                  value={pm.name}
                  onChange={(e) => updatePayment(idx, { name: e.target.value })}
                  className="text-xs font-bold bg-transparent border-b border-transparent focus:border-[#111111] w-full"
                />
                <input
                  type="text"
                  value={pm.description}
                  onChange={(e) =>
                    updatePayment(idx, { description: e.target.value })
                  }
                  className="text-[11px] text-[#111111]/65 bg-transparent w-full focus:outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={pm.enabled}
                  onChange={(e) =>
                    updatePayment(idx, { enabled: e.target.checked })
                  }
                  className="accent-[#111111] w-4 h-4"
                />
                <span>{pm.enabled ? "مفعلة" : "معطلة"}</span>
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* Contact & Social */}
      <section className="bg-white border border-[#D8C8B5]/80 p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
          معلومات التواصل وحسابات التواصل الاجتماعي
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              رقم الهاتف
            </label>
            <input
              type="text"
              dir="ltr"
              value={settings.contact_phone}
              onChange={(e) =>
                setSettings({ ...settings, contact_phone: e.target.value })
              }
              className="w-full text-right border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              البريد الإلكتروني للتواصل
            </label>
            <input
              type="email"
              dir="ltr"
              value={settings.contact_email}
              onChange={(e) =>
                setSettings({ ...settings, contact_email: e.target.value })
              }
              className="w-full text-right border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold mb-1.5">العنوان</label>
            <input
              type="text"
              value={settings.contact_address}
              onChange={(e) =>
                setSettings({ ...settings, contact_address: e.target.value })
              }
              className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              رابط إنستغرام
            </label>
            <input
              type="url"
              dir="ltr"
              value={settings.instagram_url}
              onChange={(e) =>
                setSettings({ ...settings, instagram_url: e.target.value })
              }
              className="w-full text-right border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5">
              رابط تيك توك
            </label>
            <input
              type="url"
              dir="ltr"
              value={settings.tiktok_url}
              onChange={(e) =>
                setSettings({ ...settings, tiktok_url: e.target.value })
              }
              className="w-full text-right border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Policies & Store Info */}
      <section className="bg-white border border-[#D8C8B5]/80 p-6 space-y-4">
        <h2 className="text-sm font-bold text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
          السياسات ومعلومات المتجر
        </h2>

        <div>
          <label className="block text-xs font-semibold mb-1.5">
            نبذة ومعلومات المتجر
          </label>
          <textarea
            rows={2}
            value={settings.store_info}
            onChange={(e) =>
              setSettings({ ...settings, store_info: e.target.value })
            }
            className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5">
            سياسة الشحن
          </label>
          <textarea
            rows={3}
            value={settings.shipping_policy}
            onChange={(e) =>
              setSettings({ ...settings, shipping_policy: e.target.value })
            }
            className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5">
            سياسة الخصوصية
          </label>
          <textarea
            rows={3}
            value={settings.privacy_policy}
            onChange={(e) =>
              setSettings({ ...settings, privacy_policy: e.target.value })
            }
            className="w-full border border-[#D8C8B5] px-3.5 py-2.5 text-sm"
          />
        </div>
      </section>

      {/* FAQs */}
      <section className="bg-white border border-[#D8C8B5]/80 p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#D8C8B5]/50">
          <h2 className="text-sm font-bold text-[#111111]">الأسئلة الشائعة</h2>
          <button
            type="button"
            onClick={() =>
              setSettings({
                ...settings,
                faqs: [...settings.faqs, { question: "", answer: "" }],
              })
            }
            className="px-3 py-1.5 bg-[#EFEAE2] hover:bg-[#D8C8B5] text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة سؤال</span>
          </button>
        </div>

        <div className="space-y-4">
          {settings.faqs.map((faq, idx) => (
            <div
              key={idx}
              className="p-4 bg-[#F7F4EF]/70 border border-[#D8C8B5]/70 space-y-2.5"
            >
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => updateFaq(idx, { question: e.target.value })}
                  placeholder="السؤال..."
                  className="flex-1 bg-white border border-[#D8C8B5] px-3 py-2 text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      faqs: settings.faqs.filter((_, i) => i !== idx),
                    })
                  }
                  className="p-2 text-rose-700 hover:bg-rose-50"
                  title="حذف السؤال"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                rows={2}
                value={faq.answer}
                onChange={(e) => updateFaq(idx, { answer: e.target.value })}
                placeholder="الإجابة..."
                className="w-full bg-white border border-[#D8C8B5] px-3 py-2 text-xs"
              />
            </div>
          ))}
        </div>
        <MediaPickerModal
          open={logoPickerOpen}
          onClose={() => setLogoPickerOpen(false)}
          onSelect={(url) => setSettings({ ...settings, logo_url: url })}
        />
      </section>
    </form>
  );
}
