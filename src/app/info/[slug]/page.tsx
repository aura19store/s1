import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, Mail, MapPin, Truck, ShieldCheck } from "lucide-react";
import { getGenders, getStoreSettings } from "@/lib/store-queries";
import { StoreFooter } from "@/components/store/StoreFooter";
import { WhatsAppFloatingButton } from "@/components/store/WhatsAppFloatingButton";
import {
  EmailContactIcon,
  WhatsAppIcon,
  buildTelHref,
  buildWhatsAppUrl,
} from "@/components/store/ContactIcons";
import { AURA_CONTACT, AURA_SHIPPING_TEXT } from "@/lib/constants";
import { formatIQD } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_TITLES: Record<string, string> = {
  contact: "تواصل معنا",
  shipping: "سياسة الشحن والتوصيل",
  faq: "الأسئلة الشائعة",
  privacy: "سياسة الخصوصية",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = PAGE_TITLES[slug];
  if (!title) return { title: "صفحة غير موجودة" };
  return {
    title,
    description: `${title} — متجر AURA للإكسسوارات الفاخرة في العراق.`,
  };
}

export default async function InfoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pageTitle = PAGE_TITLES[slug];
  if (!pageTitle) notFound();

  const settings = getStoreSettings();
  const genders = getGenders();

  const phoneDisplay = settings.contact_phone || AURA_CONTACT.phoneDisplay;
  const emailDisplay = settings.contact_email || AURA_CONTACT.email;
  const locationDisplay = settings.contact_address || AURA_CONTACT.location;
  const telHref = buildTelHref(phoneDisplay);
  const mailHref = `mailto:${emailDisplay}`;
  const whatsappHref = buildWhatsAppUrl(
    phoneDisplay,
    "مرحبًا، أرغب بالتواصل مع فريق دعم متجر AURA."
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F4EF] text-[#111111]">
      {/* Clean Top Bar */}
      <header className="sticky top-0 z-30 bg-[#F7F4EF]/95 backdrop-blur-md border-b border-[#D8C8B5]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link
            href="/"
            className="font-brand text-2xl sm:text-3xl tracking-[0.26em] text-[#111111]"
          >
            {settings.store_name}
          </Link>
          <div className="flex items-center gap-3">
            {genders.map((g) => (
              <Link
                key={g.id}
                href={`/store/${g.slug}`}
                className="px-4 py-2 text-xs sm:text-sm font-medium border border-[#D8C8B5] bg-white hover:border-[#111111] transition"
              >
                {g.slug === "women" ? "النسائي" : "الرجالي"}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-14 sm:py-20">
        <div className="mb-10 pb-6 border-b border-[#D8C8B5]/70">
          <p className="text-xs font-medium text-[#B79B6C] mb-2">
            المساعدة وخدمة العملاء — {settings.store_name}
          </p>
          <h1 className="font-editorial text-4xl sm:text-5xl text-[#111111]">
            {pageTitle}
          </h1>
        </div>

        {slug === "contact" && (
          <div className="space-y-8">
            <p className="text-base text-[#111111]/80 leading-relaxed">
              {settings.store_info}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <a
                href={telHref}
                className="group bg-white border border-[#D8C8B5]/70 hover:border-[#111111] p-6 space-y-2.5 transition block"
              >
                <Phone className="w-5 h-5 text-[#B79B6C]" />
                <h2 className="text-sm font-semibold text-[#111111]">
                  رقم الهاتف
                </h2>
                <p
                  className="text-sm text-[#111111]/80 group-hover:text-[#B79B6C] transition font-medium"
                  dir="ltr"
                >
                  <span className="inline-block text-right">{phoneDisplay}</span>
                </p>
                <p className="text-[11px] text-[#111111]/50">
                  اضغط للاتصال المباشر
                </p>
              </a>

              <a
                href={mailHref}
                className="group bg-white border border-[#D8C8B5]/70 hover:border-[#111111] p-6 space-y-2.5 transition block"
              >
                <Mail className="w-5 h-5 text-[#B79B6C]" />
                <h2 className="text-sm font-semibold text-[#111111]">
                  البريد الإلكتروني
                </h2>
                <p
                  className="text-sm text-[#111111]/80 group-hover:text-[#B79B6C] transition font-medium break-all"
                  dir="ltr"
                >
                  <span className="inline-block text-right">{emailDisplay}</span>
                </p>
                <p className="text-[11px] text-[#111111]/50">
                  اضغط لإرسال رسالة إلكترونية
                </p>
              </a>

              <div className="bg-white border border-[#D8C8B5]/70 p-6 space-y-2.5">
                <MapPin className="w-5 h-5 text-[#B79B6C]" />
                <h2 className="text-sm font-semibold text-[#111111]">الموقع</h2>
                <p className="text-sm text-[#111111]/80 font-medium">
                  {locationDisplay}
                </p>
                <p className="text-[11px] text-[#111111]/50">
                  التوصيل لجميع محافظات العراق الـ18
                </p>
              </div>
            </div>

            {/* Direct Contact Channels: WhatsApp & Email */}
            <div className="bg-white border border-[#D8C8B5]/70 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="space-y-1">
                <h2 className="font-editorial text-2xl text-[#111111]">
                  التواصل السريع مع الدعم
                </h2>
                <p className="text-xs sm:text-sm text-[#111111]/65">
                  فريق خدمة العملاء في AURA جاهز للرد على جميع استفساراتكم عبر
                  واتساب أو البريد الإلكتروني.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-5 py-3 bg-[#111111] text-[#F7F4EF] hover:bg-[#B79B6C] hover:text-[#111111] text-xs sm:text-sm font-medium transition"
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  <span>واتساب</span>
                </a>
                <a
                  href={mailHref}
                  className="inline-flex items-center gap-2.5 px-5 py-3 border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-[#F7F4EF] text-xs sm:text-sm font-medium transition"
                >
                  <EmailContactIcon className="w-4 h-4" />
                  <span>البريد الإلكتروني</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {slug === "shipping" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-[#D8C8B5]/70 p-6 space-y-2">
                <Truck className="w-5 h-5 text-[#B79B6C]" />
                <h2 className="text-base font-semibold">الشحن المجاني</h2>
                <p className="text-sm text-[#111111]/75">
                  للطلبات بقيمة{" "}
                  <strong>{formatIQD(settings.free_shipping_threshold_iqd)}</strong>{" "}
                  أو أكثر داخل جميع محافظات العراق الـ18.
                </p>
              </div>
              <div className="bg-white border border-[#D8C8B5]/70 p-6 space-y-2">
                <Truck className="w-5 h-5 text-[#111111]" />
                <h2 className="text-base font-semibold">رسوم الشحن القياسية</h2>
                <p className="text-sm text-[#111111]/75">
                  <strong>{formatIQD(settings.shipping_fee_iqd)}</strong> فقط
                  للطلبات الأقل من{" "}
                  {formatIQD(settings.free_shipping_threshold_iqd)}.
                </p>
              </div>
            </div>
            <div className="bg-white border border-[#D8C8B5]/70 p-8 text-sm sm:text-base text-[#111111]/80 leading-loose whitespace-pre-line">
              {settings.shipping_policy || AURA_SHIPPING_TEXT}
            </div>
          </div>
        )}

        {slug === "privacy" && (
          <div className="bg-white border border-[#D8C8B5]/70 p-8 space-y-4">
            <ShieldCheck className="w-6 h-6 text-[#B79B6C]" />
            <div className="text-sm sm:text-base text-[#111111]/80 leading-loose whitespace-pre-line">
              {settings.privacy_policy}
            </div>
          </div>
        )}

        {slug === "faq" && (
          <div className="space-y-4">
            {settings.faqs.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-[#D8C8B5]/70 p-6 space-y-2.5"
              >
                <h2 className="text-base font-semibold text-[#111111]">
                  {item.question}
                </h2>
                <p className="text-sm text-[#111111]/75 leading-relaxed">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      <StoreFooter settings={settings} />
      <WhatsAppFloatingButton phone={phoneDisplay} />
    </div>
  );
}
