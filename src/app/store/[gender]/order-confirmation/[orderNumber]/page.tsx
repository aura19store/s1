import React from "react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { findBrowserOrder, readOrderBrowserCookie } from "@/lib/guest-order-access";
import { TrackingSecret } from "@/components/store/TrackingSecret";
import { CheckCircle2, Package, MapPin, CreditCard } from "lucide-react";
import { queryAll } from "@/db";
import { formatArabicDateTime, formatIQD } from "@/lib/format";
import { AURA_CONTACT } from "@/lib/constants";
import { GUEST_ORDER_STATUS_LABELS } from "@/lib/guest-order-status";
import { WhatsAppIcon, buildWhatsAppUrl } from "@/components/store/ContactIcons";

export const dynamic = "force-dynamic";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ gender: string; orderNumber: string }>;
}) {
  const { gender, orderNumber } = await params;
  const decodedNum = orderNumber;

  const cookieStore = await cookies();
  const host = (await headers()).get("host") || "";
  const browser = readOrderBrowserCookie(name => cookieStore.get(name)?.value, host);
  const order = await findBrowserOrder(decodedNum, browser);
  if (!order) return <div className="max-w-3xl mx-auto p-8 text-center"><h1 className="text-2xl">الطلب غير متاح</h1><p className="mt-4">قد يكون الطلب محذوفًا أو تحتاج إلى بيانات التتبع.</p><Link className="inline-block mt-5 underline" href={`/store/${gender}/orders`}>الانتقال إلى طلباتي</Link></div>;

  const items = await queryAll<{
    id: number;
    product_name: string;
    product_sku: string;
    product_image: string;
    variant_label: string;
    quantity: number;
    unit_price_iqd: number;
    total_price_iqd: number;
  }>(`SELECT * FROM order_items WHERE order_id = ?`, order.id);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
      <div className="bg-white border border-[#D8C8B5]/80 p-7 sm:p-12 space-y-8">
        <div className="text-center space-y-3 pb-6 border-b border-[#D8C8B5]/60">
          <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-700" />
          </div>
          <p className="text-xs font-semibold text-[#B79B6C]">
            تم استلام طلبك بنجاح
          </p>
          <h1 className="font-editorial text-3xl sm:text-4xl text-[#111111]">
            شكرًا لتسوقك من AURA
          </h1>
          <p className="text-sm text-[#111111]/70">
            سيتواصل فريقنا معك قريبًا لتأكيد تفاصيل التوصيل.
          </p>
          <div className="inline-block mt-2 px-5 py-2 bg-[#F7F4EF] border border-[#D8C8B5] text-sm font-semibold text-[#111111]">
            رقم الطلب: {order.order_number}
          </div>
        </div>

        <TrackingSecret orderNumber={order.order_number} gender={gender} />

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-[#F7F4EF]/70 p-4 border border-[#D8C8B5]/50 space-y-1">
            <div className="flex items-center gap-1.5 text-[#B79B6C] font-semibold">
              <Package className="w-4 h-4" />
              <span>حالة الطلب</span>
            </div>
            <p className="text-sm font-semibold text-[#111111]">
              {GUEST_ORDER_STATUS_LABELS[order.status] || "غير متاحة"}
            </p>
            <p className="text-[#111111]/55">
              {formatArabicDateTime(order.created_at)}
            </p>
          </div>

          <div className="bg-[#F7F4EF]/70 p-4 border border-[#D8C8B5]/50 space-y-1">
            <div className="flex items-center gap-1.5 text-[#B79B6C] font-semibold">
              <MapPin className="w-4 h-4" />
              <span>عنوان التوصيل</span>
            </div>
            <p className="text-sm font-semibold text-[#111111]">
              {order.customer_name}
            </p>
            <p className="text-[#111111]/70">
              {order.governorate}، {order.city}
            </p>
          </div>

          <div className="bg-[#F7F4EF]/70 p-4 border border-[#D8C8B5]/50 space-y-1">
            <div className="flex items-center gap-1.5 text-[#B79B6C] font-semibold">
              <CreditCard className="w-4 h-4" />
              <span>طريقة الدفع</span>
            </div>
            <p className="text-sm font-semibold text-[#111111]">
              {order.payment_method}
            </p>
            <p className="text-[#111111]/55">الدينار العراقي (د.ع)</p>
          </div>
        </div>

        {order.payment_method.includes("ماستر كارد") && (
          <div className="bg-[#111111] text-[#F7F4EF] border border-[#B79B6C]/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#B79B6C]">
                تفاصيل التحويل — ماستر كارد ({AURA_CONTACT.mastercardNumber})
              </p>
              <p className="text-xs text-[#D8C8B5] leading-relaxed">
                إذا كان الطلب هدية، يمكنك إرسال وصل التحويل إلى الدعم عبر واتساب
                لتأكيد الدفع مع ذكر رقم الطلب {order.order_number}.
              </p>
            </div>
            <a
              href={buildWhatsAppUrl(
                AURA_CONTACT.whatsappDigits,
                `مرحبًا، أرفق لكم وصل التحويل للطلب رقم ${order.order_number} عبر ماستر كارد.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#B79B6C] text-[#111111] hover:bg-[#F7F4EF] text-xs font-semibold transition shrink-0"
            >
              <WhatsAppIcon className="w-4 h-4" />
              <span>واتساب الدعم</span>
            </a>
          </div>
        )}

        {/* Ordered Items */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-[#111111]">
            تفاصيل المنتجات المطلوبة
          </h2>
          <div className="divide-y divide-[#D8C8B5]/50 border-y border-[#D8C8B5]/50">
            {items.map((it) => (
              <div key={it.id} className="py-4 flex items-center gap-4">
                <img
                  src={it.product_image || "/images/brand-story.jpg"}
                  alt={it.product_name}
                  className="w-16 h-20 object-cover bg-[#EFEAE2]"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#111111]">
                    {it.product_name}
                  </p>
                  {it.variant_label && (
                    <p className="text-xs text-[#111111]/60">
                      {it.variant_label}
                    </p>
                  )}
                  <p className="text-xs text-[#111111]/60 mt-1">
                    الكمية: {it.quantity} × {formatIQD(it.unit_price_iqd)}
                  </p>
                </div>
                <span className="text-sm font-bold text-[#111111]">
                  {formatIQD(it.total_price_iqd)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-2 text-sm max-w-xs mr-auto">
          <div className="flex justify-between text-[#111111]/75">
            <span>المجموع الفرعي</span>
            <span>{formatIQD(order.subtotal_iqd)}</span>
          </div>
          {order.discount_iqd > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>إجمالي الخصم</span>
              <span>- {formatIQD(order.discount_iqd)}</span>
            </div>
          )}
          <div className="flex justify-between text-[#111111]/75">
            <span>الشحن</span>
            <span>
              {order.shipping_iqd === 0 ? "مجاني" : formatIQD(order.shipping_iqd)}
            </span>
          </div>
          <div className="flex justify-between text-lg font-bold text-[#111111] pt-3 border-t border-[#D8C8B5]">
            <span>الإجمالي الكلي</span>
            <span>{formatIQD(order.total_iqd)}</span>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/store/${gender}`}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#111111] text-[#F7F4EF] text-sm font-semibold text-center hover:bg-[#B79B6C] hover:text-[#111111] transition"
          >
            العودة إلى المتجر
          </Link>
          <Link
            href={`/store/${gender}/products`}
            className="w-full sm:w-auto px-8 py-3.5 border border-[#111111] text-[#111111] text-sm font-semibold text-center hover:bg-[#EFEAE2] transition"
          >
            تصفح المزيد من القطع
          </Link>
        </div>
      </div>
    </div>
  );
}
