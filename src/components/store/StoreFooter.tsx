import React from "react";
import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import type { StoreSettings } from "@/lib/store-queries";
import { AURA_CONTACT } from "@/lib/constants";
import {
  EmailContactIcon,
  WhatsAppIcon,
  buildTelHref,
  buildWhatsAppUrl,
} from "./ContactIcons";

function safeSocialUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function StoreFooter({
  settings,
  genderSlug = "men",
}: {
  settings: StoreSettings;
  genderSlug?: string;
}) {
  const phoneDisplay = settings.contact_phone || AURA_CONTACT.phoneDisplay;
  const emailDisplay = settings.contact_email || AURA_CONTACT.email;
  const locationDisplay = settings.contact_address || AURA_CONTACT.location;
  const whatsappHref = buildWhatsAppUrl(phoneDisplay);
  const telHref = buildTelHref(phoneDisplay);
  const mailHref = `mailto:${emailDisplay}`;
  const instagramHref = safeSocialUrl(settings.instagram_url);
  const tiktokHref = safeSocialUrl(settings.tiktok_url);

  return (
    <footer className="bg-[#111111] text-[#F7F4EF] border-t border-[#B79B6C]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link
              href={`/store/${genderSlug}`}
              className="inline-block font-brand text-3xl tracking-[0.28em] text-[#F7F4EF]"
            >
              {settings.store_name}
            </Link>
            <p className="text-base font-editorial text-[#B79B6C]">
              {settings.tagline}
            </p>
            <p className="text-sm text-[#D8C8B5]/80 leading-relaxed max-w-xs">
              {settings.secondary_tagline}
            </p>
          </div>

          {/* Shopping Column */}
          <div>
            <h3 className="text-xs font-semibold text-[#B79B6C] tracking-wider mb-4">
              التسوق
            </h3>
            <ul className="space-y-3 text-sm text-[#F7F4EF]/80">
              <li>
                <Link
                  href="/store/men"
                  className="hover:text-[#B79B6C] transition"
                >
                  الرجالي
                </Link>
              </li>
              <li>
                <Link
                  href="/store/women"
                  className="hover:text-[#B79B6C] transition"
                >
                  النسائي
                </Link>
              </li>
              <li>
                <Link
                  href={`/store/${genderSlug}/products?collection=new-arrivals`}
                  className="hover:text-[#B79B6C] transition"
                >
                  وصل حديثًا
                </Link>
              </li>
              <li>
                <Link
                  href={`/store/${genderSlug}/products?collection=bestsellers`}
                  className="hover:text-[#B79B6C] transition"
                >
                  الأكثر طلباً
                </Link>
              </li>
            </ul>
          </div>

          {/* Help Column (No Returns/Exchange) */}
          <div>
            <h3 className="text-xs font-semibold text-[#B79B6C] tracking-wider mb-4">
              المساعدة
            </h3>
            <ul className="space-y-3 text-sm text-[#F7F4EF]/80">
              <li>
                <Link
                  href="/info/contact"
                  className="hover:text-[#B79B6C] transition"
                >
                  تواصل معنا
                </Link>
              </li>
              <li>
                <Link
                  href="/info/shipping"
                  className="hover:text-[#B79B6C] transition"
                >
                  الشحن
                </Link>
              </li>
              <li>
                <Link
                  href="/info/faq"
                  className="hover:text-[#B79B6C] transition"
                >
                  الأسئلة الشائعة
                </Link>
              </li>
              <li>
                <Link
                  href="/info/privacy"
                  className="hover:text-[#B79B6C] transition"
                >
                  سياسة الخصوصية
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Us Column (Replaces "تابعنا" with direct clickable contact & WhatsApp/Email icons) */}
          <div>
            <h3 className="text-xs font-semibold text-[#B79B6C] tracking-wider mb-4">
              تواصل معنا
            </h3>
            <ul className="space-y-3 text-sm text-[#F7F4EF]/85">
              <li>
                <a
                  href={telHref}
                  className="inline-flex items-center gap-2.5 hover:text-[#B79B6C] transition"
                >
                  <Phone className="w-4 h-4 text-[#B79B6C] shrink-0" />
                  <span dir="ltr" className="inline-block text-right">
                    {phoneDisplay}
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={mailHref}
                  className="inline-flex items-center gap-2.5 hover:text-[#B79B6C] transition break-all"
                >
                  <Mail className="w-4 h-4 text-[#B79B6C] shrink-0" />
                  <span dir="ltr" className="inline-block text-right">
                    {emailDisplay}
                  </span>
                </a>
              </li>
              <li className="flex items-center gap-2.5 text-[#D8C8B5]/80">
                <MapPin className="w-4 h-4 text-[#B79B6C] shrink-0" />
                <span>{locationDisplay}</span>
              </li>
            </ul>

            {(instagramHref || tiktokHref) && (
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#F7F4EF]/85">
                {instagramHref && <a href={instagramHref} target="_blank" rel="noopener noreferrer" className="hover:text-[#B79B6C] transition">إنستغرام</a>}
                {tiktokHref && <a href={tiktokHref} target="_blank" rel="noopener noreferrer" className="hover:text-[#B79B6C] transition">تيك توك</a>}
              </div>
            )}

            {/* Elegant Direct Contact Icons: WhatsApp + Email */}
            <div className="mt-5 flex items-center gap-3">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="تواصل عبر واتساب"
                title="واتساب"
                className="w-10 h-10 rounded-full border border-[#B79B6C]/45 bg-[#F7F4EF]/5 hover:bg-[#B79B6C] hover:border-[#B79B6C] text-[#F7F4EF] hover:text-[#111111] flex items-center justify-center transition-all duration-300"
              >
                <WhatsAppIcon className="w-4 h-4" />
              </a>
              <a
                href={mailHref}
                aria-label="تواصل عبر البريد الإلكتروني"
                title="البريد الإلكتروني"
                className="w-10 h-10 rounded-full border border-[#B79B6C]/45 bg-[#F7F4EF]/5 hover:bg-[#B79B6C] hover:border-[#B79B6C] text-[#F7F4EF] hover:text-[#111111] flex items-center justify-center transition-all duration-300"
              >
                <EmailContactIcon className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-[#F7F4EF]/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#D8C8B5]/70">
          <p>© 2026 {settings.store_name}. جميع الحقوق محفوظة.</p>
          <div className="flex items-center gap-5">
            <Link
              href="/info/privacy"
              className="hover:text-[#F7F4EF] transition"
            >
              سياسة الخصوصية
            </Link>
            <span>العراق • الدينار العراقي (د.ع)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
