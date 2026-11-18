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
  const right = 195, bottom = 280;
  let y = 20;
  const line = (text: string, size = 11) => {
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(text, 180);
    for (const part of lines) {
      if (y > bottom) { doc.addPage(); y = 20; }
      doc.text(part, right, y, { align: "right" });
      y += size >= 15 ? 9 : 7;
    }
  };
  line("AURA", 18);
  line(`تفاصيل الطلب: ${order.order_number}`, 15);
  line(`التاريخ: ${formatArabicDateTime(order.created_at)}`);
  line(`حالة الطلب: ${ORDER_STATUS_LABELS[order.status] || order.status}`);
  line(`طريقة الدفع: ${order.payment_method}`);
  line(`العميل: ${order.customer_name}`);
  line(`الهاتف: ${order.customer_phone}`);
  if (order.customer_email) line(`البريد الإلكتروني: ${order.customer_email}`);
  line(`التوصيل: ${[order.governorate, order.city, order.address].filter(Boolean).join("، ")}`);
  if (order.notes) line(`ملاحظات: ${order.notes}`);
  y += 3;
  line("المنتجات", 15);
  for (const item of items) {
    line(`${item.product_name}${item.variant_label ? ` — ${item.variant_label}` : ""}`);
    line(`الكمية: ${item.quantity} | سعر الوحدة: ${formatIQD(item.unit_price_iqd)} | الإجمالي: ${formatIQD(item.total_price_iqd)}`);
  }
  y += 3;
  line(`المجموع الفرعي بعد الخصم: ${formatIQD(order.subtotal_iqd)}`);
  if (Number(order.discount_iqd) > 0) line(`الخصم: ${formatIQD(order.discount_iqd)}`);
  line(`الشحن: ${formatIQD(order.shipping_iqd)}`);
  line(`الإجمالي النهائي: ${formatIQD(order.total_iqd)}`, 15);
  return doc;
}
