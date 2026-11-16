"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "تأكيد الحذف",
  cancelLabel = "إلغاء",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#111111]/60 backdrop-blur-xs"
        onClick={onCancel}
      />
      <div className="relative z-10 w-full max-w-md bg-white border border-[#D8C8B5] p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#111111]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="إغلاق"
            className="text-[#111111]/50 hover:text-[#111111]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-[#111111]/75 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-5 py-2.5 border border-[#D8C8B5] text-xs font-semibold text-[#111111] hover:bg-[#F7F4EF]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-5 py-2.5 bg-rose-700 text-white text-xs font-semibold hover:bg-rose-800 disabled:opacity-50"
          >
            {loading ? "جاري التنفيذ..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
