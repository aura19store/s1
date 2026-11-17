import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryAll, queryOne, runTransaction } from "@/db";
import { getGuestSessionToken } from "@/lib/auth";
import {
  calculateShippingIQD,
  computeProductPricing,
  getActivePromotions,
} from "@/lib/pricing";
import { getStoreSettings } from "@/lib/store-queries";

const checkoutSchema = z.object({
  customerName: z.string().trim().min(3, "يرجى إدخال الاسم الكامل بشكل صحيح."),
  customerPhone: z
    .string()
    .trim()
    .regex(
      /^(07\d{9}|\+?9647\d{9})$/,
      "يرجى إدخال رقم هاتف عراقي صحيح يبدأ بـ 07 ويتكون من 11 رقمًا."
    ),
  customerEmail: z
    .string()
    .trim()
    .email("يرجى إدخال بريد إلكتروني صحيح.")
    .optional()
    .or(z.literal("")),
  governorate: z.string().trim().min(2, "يرجى اختيار المحافظة."),
  city: z.string().trim().min(2, "يرجى إدخال المدينة أو المنطقة."),
  address: z.string().trim().min(5, "يرجى إدخال العنوان التفصيلي."),
  notes: z.string().trim().max(500).optional().default(""),
  paymentMethod: z.string().trim().min(2, "يرجى اختيار طريقة الدفع."),
});

export async function POST(request: NextRequest) {
  try {
    const token = await getGuestSessionToken();
    if (!token) {
      return NextResponse.json(
        { error: "سلة التسوق فارغة، يرجى إضافة منتجات أولًا." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "يرجى التحقق من جميع الحقول المطلوبة.";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const settings = await getStoreSettings();
    const enabledPaymentNames = settings.payment_methods
      .filter((m) => m.enabled)
      .map((m) => m.name);
    const chosenPayment = enabledPaymentNames.includes(parsed.data.paymentMethod)
      ? parsed.data.paymentMethod
      : enabledPaymentNames[0] || "الدفع عند الاستلام";

    const cart = await queryOne<{ id: number }>(
      `SELECT id FROM carts WHERE session_token = ?`,
      token
    );
    if (!cart) {
      return NextResponse.json(
        { error: "سلة التسوق فارغة." },
        { status: 400 }
      );
    }

    const cartRows = await queryAll<{
      product_id: number;
      variant_label: string;
      quantity: number;
      name: string;
      sku: string;
      gender_id: number;
      category_id: number | null;
      price_iqd: number;
      discount_price_iqd: number | null;
      stock_quantity: number;
      status: string;
      primary_image: string | null;
    }>(
      `SELECT ci.product_id, ci.variant_label, ci.quantity,
              p.name, p.sku, p.gender_id, p.category_id, p.price_iqd,
              p.discount_price_iqd, p.stock_quantity, p.status,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.sort_order ASC LIMIT 1) as primary_image
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = ?`,
      cart.id
    );

    if (cartRows.length === 0) {
      return NextResponse.json(
        { error: "سلة التسوق فارغة، أضف منتجات للمتابعة." },
        { status: 400 }
      );
    }

    for (const item of cartRows) {
      if (item.status !== "active") {
        return NextResponse.json(
          { error: `المنتج "${item.name}" لم يعد متوفرًا حاليًا.` },
          { status: 400 }
        );
      }
      if (item.stock_quantity < item.quantity) {
        return NextResponse.json(
          {
            error: `الكمية المطلوبة من "${item.name}" غير متوفرة حاليًا (المتبقي: ${item.stock_quantity}).`,
          },
          { status: 400 }
        );
      }
    }

    const activePromos = await getActivePromotions();
    let originalSubtotal = 0;
    let subtotalIqd = 0;

    const preparedItems = cartRows.map((item) => {
      const pricing = computeProductPricing(
        {
          id: item.product_id,
          gender_id: item.gender_id,
          category_id: item.category_id,
          price_iqd: item.price_iqd,
          discount_price_iqd: item.discount_price_iqd,
        },
        activePromos
      );
      originalSubtotal += pricing.originalPrice * item.quantity;
      subtotalIqd += pricing.finalPrice * item.quantity;
      return {
        ...item,
        unitPrice: pricing.finalPrice,
        lineTotal: pricing.finalPrice * item.quantity,
      };
    });

    const discountIqd = Math.max(0, originalSubtotal - subtotalIqd);
    const shippingIqd = calculateShippingIQD(
      subtotalIqd,
      settings.free_shipping_threshold_iqd,
      settings.shipping_fee_iqd
    );
    const totalIqd = subtotalIqd + shippingIqd;

    const orderResult = await runTransaction(async (tx) => {
      // Generate unique order number
      const countRow = await tx.queryOne<{ c: number }>(
        `SELECT COUNT(*) as c FROM orders`
      );
      const orderNumber = `AURA-2026-${1001 + Number(countRow?.c ?? 0) + Math.floor(Math.random() * 50)}`;

      // Upsert Customer
      const existingCustomer = await tx.queryOne<{ id: number }>(
        `SELECT id FROM customers WHERE phone = ?`,
        parsed.data.customerPhone
      );

      let customerId: number;
      if (existingCustomer) {
        customerId = Number(existingCustomer.id);
        await tx.execute(
          `UPDATE customers
           SET name = ?, email = COALESCE(NULLIF(?, ''), email),
               governorate = ?, city = ?, address = ?,
               orders_count = orders_count + 1,
               total_spent_iqd = total_spent_iqd + ?,
               last_order_at = datetime('now')
           WHERE id = ?`,
          parsed.data.customerName,
          parsed.data.customerEmail || "",
          parsed.data.governorate,
          parsed.data.city,
          parsed.data.address,
          totalIqd,
          customerId
        );
      } else {
        const custIns = await tx.execute(
          `INSERT INTO customers (name, phone, email, governorate, city, address, orders_count, total_spent_iqd, last_order_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))`,
          parsed.data.customerName,
          parsed.data.customerPhone,
          parsed.data.customerEmail || "",
          parsed.data.governorate,
          parsed.data.city,
          parsed.data.address,
          totalIqd
        );
        customerId = Number(custIns.lastInsertRowid);
      }

      // Insert Order
      const orderIns = await tx.execute(
        `INSERT INTO orders (
           order_number, customer_id, customer_name, customer_phone, customer_email,
           governorate, city, address, notes, payment_method, payment_status,
           currency_code, subtotal_iqd, discount_iqd, shipping_iqd, total_iqd, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'IQD', ?, ?, ?, ?, 'pending')`,
        orderNumber,
        customerId,
        parsed.data.customerName,
        parsed.data.customerPhone,
        parsed.data.customerEmail || "",
        parsed.data.governorate,
        parsed.data.city,
        parsed.data.address,
        parsed.data.notes || "",
        chosenPayment,
        subtotalIqd,
        discountIqd,
        shippingIqd,
        totalIqd
      );
      const orderId = Number(orderIns.lastInsertRowid);

      const insertItemSql = `INSERT INTO order_items (
           order_id, product_id, product_name, product_sku, product_image,
           variant_label, quantity, unit_price_iqd, total_price_iqd
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const updateStockSql = `UPDATE products
         SET stock_quantity = MAX(0, stock_quantity - ?),
             sales_count = sales_count + ?,
             updated_at = datetime('now')
         WHERE id = ?`;

      for (const it of preparedItems) {
        await tx.execute(
          insertItemSql,
          orderId,
          it.product_id,
          it.name,
          it.sku,
          it.primary_image || "/images/brand-story.jpg",
          it.variant_label,
          it.quantity,
          it.unitPrice,
          it.lineTotal
        );
        await tx.execute(updateStockSql, it.quantity, it.quantity, it.product_id);
      }

      // Clear cart
      await tx.execute(`DELETE FROM cart_items WHERE cart_id = ?`, cart.id);

      return { orderId, orderNumber, totalIqd, shippingIqd, subtotalIqd };
    });

    return NextResponse.json({
      message: "تم استلام طلبك بنجاح! شكرًا لاختيارك AURA.",
      order: orderResult,
    });
  } catch (err) {
    console.error("Checkout API error:", err);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تأكيد الطلب، يرجى المحاولة مجددًا." },
      { status: 500 }
    );
  }
}
