import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F7F4EF] text-[#111111] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-[#D8C8B5] p-10 text-center space-y-5">
        <p className="font-brand text-3xl tracking-[0.28em] text-[#111111]">
          AURA
        </p>
        <p className="text-xs font-semibold text-[#B79B6C]">
          الصفحة غير متوفرة
        </p>
        <h1 className="font-editorial text-3xl text-[#111111]">
          لم نتمكن من العثور على الصفحة المطلوبة
        </h1>
        <p className="text-sm text-[#111111]/65">
          ربما تم نقل الصفحة أو حذفها. يمكنك العودة إلى الواجهة الرئيسية واختيار
          القسم المناسب لك.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-6 py-3 bg-[#111111] text-[#F7F4EF] text-sm font-medium hover:bg-[#B79B6C] hover:text-[#111111] transition"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
