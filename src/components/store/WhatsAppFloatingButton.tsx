"use client";

import React from "react";
import { WhatsAppIcon, buildWhatsAppUrl } from "./ContactIcons";
import { AURA_CONTACT } from "@/lib/constants";

export function WhatsAppFloatingButton({ phone }: { phone?: string }) {
  const digits = (phone || AURA_CONTACT.whatsappDigits).replace(/[^\d]/g, "");
  const href = buildWhatsAppUrl(
    digits,
    "مرحبًا، أود الاستفسار عن منتجات متجر AURA."
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا عبر واتساب"
      title="تواصل معنا عبر واتساب"
      className="fixed bottom-5 right-5 z-40 group flex items-center gap-2.5 bg-[#111111] text-[#F7F4EF] border border-[#B79B6C]/60 hover:bg-[#B79B6C] hover:text-[#111111] shadow-xl rounded-full px-3.5 py-3 sm:px-4 sm:py-3 transition-all duration-300"
    >
      <WhatsAppIcon className="w-5 h-5 shrink-0 text-[#B79B6C] group-hover:text-[#111111] transition-colors" />
      <span className="hidden sm:inline text-xs font-medium tracking-wide">
        واتساب
      </span>
    </a>
  );
}
