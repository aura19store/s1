import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createOrderPdf } from "./order-pdf";

test("Arabic order PDF is generated with the embedded font without mutating order data", async () => {
  const order = {
    order_number: "TEST-2026-31", created_at: "2026-11-15T09:30:00Z", customer_name: "أحمد محمد",
    customer_phone: "07000000000", customer_email: "test@example.invalid", governorate: "بغداد", city: "الكرادة",
    address: "شارع تجريبي", notes: "ملاحظة تجريبية", payment_method: "الدفع عند الاستلام", status: "confirmed",
    subtotal_iqd: 21000, discount_iqd: 2000, shipping_iqd: 3000, total_iqd: 24000,
  };
  const items = [{ product_name: "ساعة أنيقة", variant_label: "ذهبي", quantity: 2, unit_price_iqd: 10500, total_price_iqd: 21000 }];
  const before = JSON.stringify({ order, items });
  const font = new Uint8Array(readFileSync("public/fonts/IBMPlexSansArabic-Regular.ttf"));
  const doc = await createOrderPdf(order, items, font);
  assert.equal(doc.getFont().fontName, "IBMPlexArabic");
  const bytes = Buffer.from(doc.output("arraybuffer"));
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert(bytes.byteLength > 1000);
  assert.equal(JSON.stringify({ order, items }), before);
});

test("long product rows span pages and repeat the table header", async () => {
  const order = { order_number: "123", created_at: "2026-11-15", customer_name: "أحمد", customer_phone: "07000000000", governorate: "بغداد", city: "بغداد", address: "عنوان", payment_method: "الدفع عند الاستلام", status: "confirmed", subtotal_iqd: 1000, discount_iqd: 0, shipping_iqd: 0, total_iqd: 1000 };
  const font = new Uint8Array(readFileSync("public/fonts/IBMPlexSansArabic-Regular.ttf"));
  const doc = await createOrderPdf(order, [{ product_name: "منتج عربي طويل جدا ".repeat(500), quantity: 1, unit_price_iqd: 1000, total_price_iqd: 1000 }], font);
  assert(doc.getNumberOfPages() > 2);
  // Each page contains the same filled table-header rectangle and is a valid PDF page.
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    const commands = (doc as any).internal.pages[page].join("\n");
    assert(commands.includes("0.94 0.92 0.89 rg"));
  }
  assert.equal(Buffer.from(doc.output("arraybuffer")).subarray(0, 5).toString(), "%PDF-");
});
