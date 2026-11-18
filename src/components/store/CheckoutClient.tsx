"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ShieldCheck,
  Truck,
  CreditCard,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Banknote,
} from "lucide-react";
import { getGuestTokenHeaders, useStore } from "./StoreProvider";
import { WhatsAppIcon, buildWhatsAppUrl } from "./ContactIcons";
import {
  AURA_CONTACT,
  AURA_SHIPPING_TEXT,
  IRAQI_GOVERNORATES,
} from "@/lib/constants";
import { formatIQD } from "@/lib/format";
import type { PaymentMethodConfig } from "@/lib/store-queries";

function isMastercardMethod(method: PaymentMethodConfig | undefined, name: string) {
  if (method?.id === "mastercard" || method?.id === "card") return true;
  return name.includes("ماستر كارد");
}

export function CheckoutClient({
  genderSlug,
  paymentMethods,
  contactPhone,
}: {
  genderSlug: string;
  paymentMethods: PaymentMethodConfig[];
  contactPhone?: string;
}) {
  const router = useRouter();
  const { cart, refreshCart, showToast } = useStore();

  // Keep Checkout simple: only enabled methods (always guaranteeing COD & MasterCard)
  const enabledFromSettings = paymentMethods.filter((m) => m.enabled);
  const availableMethods: PaymentMethodConfig[] =
    enabledFromSettings.length > 0
      ? enabledFromSettings
      : [
          {
            id: "cod",
            name: "الدفع عند الاستلام",
            description: "ادفع نقدًا بالدينار العراقي عند استلام طلبك بكل سهولة وأمان",
            enabled: true,
          },
          {
            id: "mastercard",
            name: "ماستر كارد",
            description: "التحويل المباشر عبر بطاقة ماستر كارد",
            enabled: true,
          },
        ];

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [governorate, setGovernorate] = useState("بغداد");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(
    availableMethods[0]?.name || "الدفع عند الاستلام"
  );
  const [credits, setCredits] = useState<{ id: number; reward_name: string; remaining_iqd: number }[]>([]);
  const [rewardGrantId, setRewardGrantId] = useState("");
  useEffect(() => { fetch("/api/store/customer/me", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => {
    if (data?.rewards?.grants) setCredits(data.rewards.grants.filter((g: { kind: string; status: string; remaining_iqd: number; expires_at: string | null }) => g.kind === "credit" && g.status === "available" && Number(g.remaining_iqd) > 0 && (!g.expires_at || new Date(g.expires_at).getTime() > Date.now())));
  }).catch(() => {}); }, []);
  const selectedCredit = credits.find(g => String(g.id) === rewardGrantId);
  const previewTotal = Math.max(0, cart.totalIqd - Number(selectedCredit?.remaining_iqd || 0));
  const [copiedCard, setCopiedCard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const activeMethodObj = availableMethods.find((m) => m.name === paymentMethod);
  const showMastercardPanel = isMastercardMethod(activeMethodObj, paymentMethod);
  const cardNumber = AURA_CONTACT.mastercardNumber;
  const whatsappSupportUrl = buildWhatsAppUrl(
    contactPhone || AURA_CONTACT.phoneDisplay,
    `مرحبًا، أود إرسال وصل التحويل الخاص بطلبي من متجر AURA عبر ماستر كارد (الإجمالي: ${formatIQD(previewTotal)}).`
  );

  const handleCopyCard = async () => {
    try {
      await navigator.clipboard.writeText(cardNumber);
      setCopiedCard(true);
      showToast("تم نسخ رقم البطاقة بنجاح.");
      setTimeout(() => setCopiedCard(false), 2600);
    } catch {
      // Fallback copy for restricted iframe clipboard permissions
      try {
        const ta = document.createElement("textarea");
        ta.value = cardNumber;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopiedCard(true);
        showToast("تم نسخ رقم البطاقة بنجاح.");
        setTimeout(() => setCopiedCard(false), 2600);
      } catch {
        showToast(`رقم البطاقة: ${cardNumber}`, "success");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/store/checkout", {
        method: "POST",
        headers: getGuestTokenHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          governorate,
          city,
          address,
          notes,
          paymentMethod,
          ...(rewardGrantId ? { rewardGrantId: Number(rewardGrantId) } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "تعذر إتمام الطلب، يرجى مراجعة البيانات.");
        setSubmitting(false);
        return;
      }

      await refreshCart();
      showToast("تم تأكيد طلبك بنجاح!");
      router.push(
        `/store/${genderSlug}/order-confirmation/${encodeURIComponent(data.order.orderNumber)}`
      );
    } catch {
      setErrorMsg("حدث خطأ في الاتصال بالخادم، يرجى المحاولة مرة أخرى.");
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="bg-white border border-[#D8C8B5]/60 p-10">
          <h1 className="font-editorial text-3xl text-[#111111] mb-3">
            سلة التسوق فارغة
          </h1>
          <p className="text-sm text-[#111111]/65 mb-6">
            يرجى إضافة منتج واحد على الأقل قبل الانتقال إلى صفحة إتمام الطلب.
          </p>
          <Link
            href={`/store/${genderSlug}/products`}
            className="inline-block px-8 py-3.5 bg-[#111111] text-[#F7F4EF] text-sm font-medium"
          >
            تصفح المنتجات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="pb-6 border-b border-[#D8C8B5]/70 mb-10">
        <p className="text-xs font-medium text-[#B79B6C] mb-1">
          التوصيل لجميع محافظات العراق الـ18 • العملة: الدينار العراقي (د.ع)
        </p>
        <h1 className="font-editorial text-3xl sm:text-5xl text-[#111111]">
          إتمام الطلب
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12"
      >
        {/* Customer & Shipping Form */}
        <div className="lg:col-span-7 space-y-8">
          {errorMsg && (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {credits.length > 0 && <section className="bg-white border border-[#D8C8B5]/70 p-6" dir="rtl"><label className="block text-sm">استخدام رصيد مكافآت AURA<select className="mt-2 w-full border p-3" value={rewardGrantId} onChange={e => setRewardGrantId(e.target.value)}><option value="">عدم استخدام الرصيد</option>{credits.map(g => <option key={g.id} value={g.id}>{g.reward_name} — {formatIQD(Number(g.remaining_iqd))}</option>)}</select></label><p className="mt-2 text-xs">الإجمالي التقريبي بعد الرصيد {formatIQD(previewTotal)}؛ يُحتسب المبلغ النهائي على الخادم عند تأكيد الطلب.</p></section>}
          {/* Section 1: Customer Info */}
          <section className="bg-white border border-[#D8C8B5]/70 p-6 sm:p-8 space-y-5">
            <h2 className="font-editorial text-2xl text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
              معلومات العميل والتوصيل
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label
                  htmlFor="co-name"
                  className="block text-xs font-semibold text-[#111111] mb-2"
                >
                  الاسم الكامل <span className="text-rose-600">*</span>
                </label>
                <input
                  id="co-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="الاسم الثلاثي الكامل"
                  className="w-full bg-[#F7F4EF]/40 border border-[#D8C8B5] px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="co-phone"
                  className="block text-xs font-semibold text-[#111111] mb-2"
                >
                  رقم الهاتف <span className="text-rose-600">*</span>
                </label>
                <input
                  id="co-phone"
                  type="tel"
                  required
                  dir="ltr"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="07701234567"
                  className="w-full text-right bg-[#F7F4EF]/40 border border-[#D8C8B5] px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="co-email"
                  className="block text-xs font-semibold text-[#111111] mb-2"
                >
                  البريد الإلكتروني (اختياري)
                </label>
                <input
                  id="co-email"
                  type="email"
                  dir="ltr"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="بريدك الإلكتروني لاستلام إشعار الطلب"
                  className="w-full text-right bg-[#F7F4EF]/40 border border-[#D8C8B5] px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="co-gov"
                  className="block text-xs font-semibold text-[#111111] mb-2"
                >
                  المحافظة <span className="text-rose-600">*</span>
                </label>
                <select
                  id="co-gov"
                  required
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  className="w-full bg-[#F7F4EF]/40 border border-[#D8C8B5] px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                >
                  {IRAQI_GOVERNORATES.map((gov) => (
                    <option key={gov} value={gov}>
                      {gov}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="co-city"
                  className="block text-xs font-semibold text-[#111111] mb-2"
                >
                  المدينة / المنطقة <span className="text-rose-600">*</span>
                </label>
                <input
                  id="co-city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="مثال: المنصور، الكرادة، تكريت، العشار..."
                  className="w-full bg-[#F7F4EF]/40 border border-[#D8C8B5] px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="co-addr"
                  className="block text-xs font-semibold text-[#111111] mb-2"
                >
                  العنوان التفصيلي <span className="text-rose-600">*</span>
                </label>
                <input
                  id="co-addr"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="اسم الشارع، رقم المحلة والزقاق، وأقرب نقطة دالة"
                  className="w-full bg-[#F7F4EF]/40 border border-[#D8C8B5] px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="co-notes"
                  className="block text-xs font-semibold text-[#111111] mb-2"
                >
                  ملاحظات الطلب (اختياري)
                </label>
                <textarea
                  id="co-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="أي ملاحظات إضافية بخصوص وقت التوصيل أو التغليف أو الهدايا..."
                  className="w-full bg-[#F7F4EF]/40 border border-[#D8C8B5] px-4 py-3 text-sm text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white"
                />
              </div>
            </div>
          </section>

          {/* Section 2: Payment Methods (COD & MasterCard with dynamic UX) */}
          <section className="bg-white border border-[#D8C8B5]/70 p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[#D8C8B5]/50">
              <CreditCard className="w-5 h-5 text-[#B79B6C]" />
              <h2 className="font-editorial text-2xl text-[#111111]">
                طريقة الدفع
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {availableMethods.map((method) => {
                const selected = paymentMethod === method.name;
                const isCard = isMastercardMethod(method, method.name);
                return (
                  <label
                    key={method.id}
                    className={`flex items-start gap-3 p-4 border transition cursor-pointer ${
                      selected
                        ? "border-[#111111] bg-[#F7F4EF] shadow-xs"
                        : "border-[#D8C8B5] bg-white hover:border-[#111111]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      checked={selected}
                      onChange={() => setPaymentMethod(method.name)}
                      className="mt-1 accent-[#111111]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isCard ? (
                          <CreditCard className="w-4 h-4 text-[#B79B6C] shrink-0" />
                        ) : (
                          <Banknote className="w-4 h-4 text-[#B79B6C] shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-[#111111]">
                          {method.name}
                        </span>
                      </div>
                      {method.description && (
                        <p className="text-xs text-[#111111]/65 mt-1.5 leading-relaxed">
                          {method.description}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Dynamic MasterCard Instructions — Shown ONLY when MasterCard is selected */}
            {showMastercardPanel && (
              <div className="bg-[#111111] text-[#F7F4EF] border border-[#B79B6C]/50 p-5 sm:p-6 space-y-4 animate-aura-fade-in">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F7F4EF]/15">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-5 h-5 text-[#B79B6C]" />
                    <div>
                      <h3 className="text-sm font-semibold text-[#F7F4EF]">
                        تعليمات الدفع عبر ماستر كارد
                      </h3>
                      <p className="text-[11px] text-[#D8C8B5]/80">
                        يرجى تحويل قيمة الطلب ({formatIQD(previewTotal)}) إلى رقم
                        البطاقة أدناه
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Number + Copy Button */}
                <div className="bg-[#F7F4EF]/10 border border-[#B79B6C]/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] text-[#B79B6C] mb-1">
                      رقم بطاقة ماستر كارد
                    </p>
                    <p
                      dir="ltr"
                      className="text-xl sm:text-2xl font-bold tracking-[0.14em] text-[#F7F4EF] select-all text-right sm:text-left"
                    >
                      {cardNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCard}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#B79B6C] text-[#111111] hover:bg-[#F7F4EF] text-xs font-semibold transition shrink-0"
                  >
                    {copiedCard ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>نسخ رقم البطاقة</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Clear Gift / Receipt Instruction + Clickable WhatsApp Support */}
                <div className="bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-xs sm:text-sm text-[#D8C8B5] leading-relaxed">
                    إذا كان الطلب هدية، يمكنك إرسال وصل التحويل إلى الدعم عبر
                    واتساب لتأكيد الدفع.
                  </p>
                  <a
                    href={whatsappSupportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[#B79B6C] text-[#F7F4EF] hover:bg-[#B79B6C] hover:text-[#111111] text-xs font-semibold transition shrink-0"
                  >
                    <WhatsAppIcon className="w-4 h-4 shrink-0" />
                    <span>إرسال الوصل عبر واتساب</span>
                  </a>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-5">
          <div className="bg-white border border-[#D8C8B5]/70 p-6 sm:p-8 sticky top-28 space-y-6">
            <h2 className="font-editorial text-2xl text-[#111111] pb-3 border-b border-[#D8C8B5]/50">
              ملخص الطلب ({cart.itemCount})
            </h2>

            <div className="space-y-4 max-h-80 overflow-y-auto pl-1">
              {cart.items.map((item) => {
                const sectionTag =
                  item.genderName ||
                  (item.genderSlug === "women" ? "نسائي" : "رجالي");
                return (
                  <div key={item.id} className="flex items-center gap-3.5">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-20 object-cover bg-[#EFEAE2] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 bg-[#EFEAE2] text-[#111111]/75 mb-0.5">
                        {sectionTag}
                      </span>
                      <p className="text-sm font-medium text-[#111111] line-clamp-1">
                        {item.name}
                      </p>
                      {item.variantLabel && (
                        <p className="text-xs text-[#111111]/55">
                          {item.variantLabel}
                        </p>
                      )}
                      <p className="text-xs text-[#111111]/65 mt-0.5">
                        الكمية: {item.quantity}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[#111111] whitespace-nowrap">
                      {formatIQD(item.lineTotal)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-[#D8C8B5]/60 space-y-2.5 text-sm">
              <div className="flex justify-between text-[#111111]/75">
                <span>المجموع الفرعي</span>
                <span>{formatIQD(cart.subtotalIqd)}</span>
              </div>
              {cart.discountIqd > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>إجمالي الخصم</span>
                  <span>- {formatIQD(cart.discountIqd)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#111111]/75">
                <span className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#B79B6C]" />
                  <span>الشحن داخل العراق</span>
                </span>
                <span>
                  {cart.shippingIqd === 0 ? (
                    <span className="text-emerald-700 font-semibold">مجاني</span>
                  ) : (
                    formatIQD(cart.shippingIqd)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold text-[#111111] pt-3 border-t border-[#D8C8B5]/60">
                <span>الإجمالي المستحق</span>
                <span>{formatIQD(previewTotal)}</span>
              </div>
            </div>

            <p className="text-[11px] text-[#111111]/65 bg-[#F7F4EF] border border-[#D8C8B5]/50 p-3 leading-relaxed">
              {AURA_SHIPPING_TEXT}
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-[#111111] text-[#F7F4EF] hover:bg-[#B79B6C] hover:text-[#111111] disabled:opacity-60 text-sm font-semibold transition flex items-center justify-center gap-2.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تأكيد الطلب...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد الطلب ({formatIQD(previewTotal)})</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-[#111111]/60 pt-1">
              <ShieldCheck className="w-4 h-4 text-[#B79B6C]" />
              <span>طلبك محمي وسيتم التواصل معك لتأكيد موعد التوصيل</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
