import type { jsPDF } from "jspdf";
import { formatArabicDateTime, formatIQD } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/constants";

export interface PdfOrder {
  order_number: string; created_at: string; customer_name: string; customer_phone: string;
  customer_email?: string | null; governorate: string; city: string; address: string;
  notes?: string | null; payment_method: string; status: string;
  subtotal_iqd: number; shipping_iqd: number; discount_iqd: number; total_iqd: number;
}
export interface PdfOrderItem {
  product_name: string; variant_label?: string | null; quantity: number;
  unit_price_iqd: number; total_price_iqd: number;
}

/** Produces a PDF without modifying the order. The supplied font must support Arabic. */
export async function createOrderPdf(order: PdfOrder, items: PdfOrderItem[], font: Uint8Array): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  let binary = "";
  for (let i = 0; i < font.length; i += 0x8000) binary += String.fromCharCode(...font.subarray(i, i + 0x8000));
  doc.addFileToVFS("IBMPlexSansArabic-Regular.ttf", btoa(binary));
  doc.addFont("IBMPlexSansArabic-Regular.ttf", "IBMPlexArabic", "normal");
  doc.setFont("IBMPlexArabic", "normal");
  // jsPDF's Arabic shaping/bidi processing handles mixed scripts itself;
  // setR2L(true) additionally reverses Latin order numbers and phone digits.
  doc.setR2L(false);
  const right = 195, left = 15, bottom = 280;
  let y = 20;
  const ink = () => doc.setTextColor(35, 32, 28);
  const text = (value: string, x: number, yy: number, size = 10, align: "right" | "left" | "center" = "right") => {
    doc.setFontSize(size); doc.text(value, x, yy, { align });
  };
  const nextPage = () => { doc.addPage(); y = 20; ink(); };
  const ensure = (height: number) => { if (y + height > bottom) nextPage(); };
  const line = (value: string, size = 10) => {
    doc.setFontSize(size);
    const parts: string[] = doc.splitTextToSize(value, 180);
    for (const part of parts) { ensure(7); text(part, right, y, size); y += 7; }
  };
  doc.setFillColor(27, 26, 24); doc.rect(left, 13, 180, 20, "F");
  doc.setTextColor(255, 255, 255); text("AURA", right - 5, 22, 17); text("تفاصيل الطلب", right - 5, 29, 10);
  ink(); y = 42;
  line(`رقم الطلب: ${order.order_number}`, 12);
  line(`التاريخ: ${formatArabicDateTime(order.created_at)}`);
  line(`حالة الطلب: ${ORDER_STATUS_LABELS[order.status] || "غير محددة"}`);
  line(`طريقة الدفع: ${order.payment_method}`);
  y += 2; line(`العميل: ${order.customer_name}`); line(`الهاتف: ${order.customer_phone}`);
  if (order.customer_email) line(`البريد الإلكتروني: ${order.customer_email}`);
  line(`عنوان التوصيل: ${[order.governorate, order.city, order.address].filter(Boolean).join("، ")}`);
  if (order.notes) line(`ملاحظات: ${order.notes}`);
  y += 4;
  const header = () => {
    ensure(14); doc.setFillColor(239, 234, 226); doc.rect(left, y - 5, 180, 10, "F"); ink();
    text("المنتج", 192, y + 1, 9); text("الكمية", 91, y + 1, 9, "center"); text("السعر", 65, y + 1, 9, "center"); text("الإجمالي", 17, y + 1, 9, "left"); y += 12;
  };
  header();
  for (const item of items) {
    doc.setFontSize(9);
    const parts: string[] = doc.splitTextToSize(`${item.product_name}${item.variant_label ? ` — ${item.variant_label}` : ""}`, 92);
    let offset = 0;
    do {
      if (y + 10 > bottom) { nextPage(); header(); }
      const count = Math.min(parts.length - offset, Math.max(1, Math.floor((bottom - y - 4) / 5)));
      parts.slice(offset, offset + count).forEach((part, i) => text(part, 192, y + i * 5, 9));
      if (offset === 0) {
        text(String(item.quantity), 91, y, 9, "center"); text(formatIQD(item.unit_price_iqd), 65, y, 9, "center"); text(formatIQD(item.total_price_iqd), 17, y, 9, "left");
      }
      y += Math.max(10, count * 5 + 4);
      offset += count;
      doc.setDrawColor(216, 200, 181); doc.line(left, y - 4, right, y - 4);
      if (offset < parts.length) { nextPage(); header(); }
    } while (offset < parts.length);
  }
  y += 3; ensure(33);
  line(`المجموع الفرعي بعد الخصم: ${formatIQD(order.subtotal_iqd)}`);
  if (Number(order.discount_iqd) > 0) line(`الخصم: ${formatIQD(order.discount_iqd)}`);
  line(`الشحن: ${formatIQD(order.shipping_iqd)}`);
  doc.setFillColor(239, 234, 226); ensure(12); doc.rect(left, y - 5, 180, 11, "F");
  text(`الإجمالي النهائي: ${formatIQD(order.total_iqd)}`, right - 3, y + 2, 12);
  return doc;
}
