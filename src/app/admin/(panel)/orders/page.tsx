"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Search, Eye, X, Check, Loader2, Download } from "lucide-react";
import { formatArabicDateTime, formatIQD } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from "@/lib/constants";

interface OrderRow {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  governorate: string;
  city: string;
  address: string;
  notes: string;
  payment_method: string;
  subtotal_iqd: number;
  discount_iqd: number;
  shipping_iqd: number;
  total_iqd: number;
  status: string;
  items_count: number;
  created_at: string;
}

interface OrderItemDetail {
  id: number;
  product_name: string;
  product_sku: string;
  product_image: string;
  variant_label: string;
  quantity: number;
  unit_price_iqd: number;
  total_price_iqd: number;
}

const ALL_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const [selectedOrder, setSelectedOrder] = useState<{
    order: OrderRow;
    items: OrderItemDetail[];
  } | null>(null);
  const [updatingIds, setUpdatingIds] = useState<ReadonlySet<number>>(new Set());
  const pendingStatus = useRef(new Map<number, string>());
  const ordersRevision = useRef(0);
  const loadSequence = useRef(0);
  const [statusError, setStatusError] = useState("");
  const uncertainStatuses = useRef(new Map<number, { previous: string; requested: string; operationId: string }>());
  const [uncertainIds, setUncertainIds] = useState<ReadonlySet<number>>(new Set());
  const resolvingStatuses = useRef(new Set<number>());
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const exportOrderPdf = async (id: number) => {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const [orderRes, fontRes, pdf] = await Promise.all([
        fetch(`/api/admin/orders/${id}`, { cache: "no-store" }),
        fetch("/fonts/IBMPlexSansArabic-Regular.ttf"),
        import("@/lib/order-pdf"),
      ]);
      if (!orderRes.ok) {
        const body = await orderRes.json().catch(() => ({}));
        throw new Error(body.error || "تعذر تحميل تفاصيل الطلب.");
      }
      if (!fontRes.ok) throw new Error("تعذر تحميل خط PDF العربي.");
      const { order, items } = await orderRes.json();
      if (!order || !Array.isArray(items)) throw new Error("بيانات الطلب غير مكتملة.");
      const doc = await pdf.createOrderPdf(order, items, new Uint8Array(await fontRes.arrayBuffer()));
      const safeName = String(order.order_number).replace(/[^A-Za-z0-9_-]/g, "_");
      doc.save(`AURA-${safeName || "order"}.pdf`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "تعذر إنشاء ملف PDF.");
    } finally {
      setExporting(false);
    }
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3200);
  };

  const loadOrders = useCallback(async () => {
    const revision = ordersRevision.current;
    const sequence = ++loadSequence.current;
    setLoading(true);
    const sp = new URLSearchParams();
    if (statusFilter !== "all") sp.set("status", statusFilter);
    if (search.trim()) sp.set("q", search.trim());
    try {
      const res = await fetch(`/api/admin/orders?${sp.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (revision === ordersRevision.current && sequence === loadSequence.current) {
          setOrders((data.orders || []).map((order: OrderRow) => pendingStatus.current.has(order.id) ? { ...order, status: pendingStatus.current.get(order.id)! } : order));
        }
      }
    } catch {
      setStatusError("تعذر تحميل الطلبات.");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openOrderDetail = async (id: number) => {
    const revision = ordersRevision.current;
    const res = await fetch(`/api/admin/orders/${id}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (revision !== ordersRevision.current) return;
      const status = pendingStatus.current.get(id);
      setSelectedOrder(status ? { ...data, order: { ...data.order, status } } : data);
    }
  };

  const resolveStatus = async (orderId: number, previous: string, status: string, operationId: string) => {
    if (resolvingStatuses.current.has(orderId)) return;
    resolvingStatuses.current.add(orderId);
    setStatusError("");
    uncertainStatuses.current.delete(orderId);
    setUncertainIds(new Set(uncertainStatuses.current.keys()));
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        let res: Response;
        try {
          res = await fetch(`/api/admin/orders/${orderId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, expected_status: previous, operation_id: operationId }),
            signal: AbortSignal.timeout(10000),
          });
        } catch {
          continue; // A lost response is ambiguous: retry the same conditional mutation.
        }
        const data = await res.json().catch(() => ({}));
        if (res.status >= 500 || (attempt > 0 && !res.ok && res.status !== 409)) continue; // A previous attempt may still commit.
        const confirmed = (res.ok || res.status === 409) && typeof data.status === "string" ? data.status : res.ok ? status : previous;
        setOrders((list) => list.map((order) => order.id === orderId ? { ...order, status: confirmed } : order));
        setSelectedOrder((detail) => detail?.order.id === orderId ? { ...detail, order: { ...detail.order, status: confirmed } } : detail);
        if (res.ok || (res.status === 409 && confirmed === status)) {
          flash(`تم تأكيد حالة الطلب: "${ORDER_STATUS_LABELS[confirmed] || confirmed}".`);
        } else {
          setStatusError(data.error || "تعذر تحديث حالة الطلب.");
        }
        if (statusFilter !== "all" && confirmed !== statusFilter) setOrders((list) => list.filter((order) => order.id !== orderId));
        pendingStatus.current.delete(orderId);
        ordersRevision.current += 1;
        setUpdatingIds(new Set(pendingStatus.current.keys()));
        return;
      }
      // Neither attempt established an outcome. Keep the row disabled and explicitly unconfirmed.
      uncertainStatuses.current.set(orderId, { previous, requested: status, operationId });
      setUncertainIds(new Set(uncertainStatuses.current.keys()));
      setStatusError("تعذر تأكيد حالة الطلب بسبب الاتصال. أعد المحاولة للتحقق قبل إجراء تغيير آخر.");
    } finally {
      resolvingStatuses.current.delete(orderId);
    }
  };

  const updateStatus = (orderId: number, status: string) => {
    const previous = orders.find((order) => order.id === orderId)?.status ?? (selectedOrder?.order.id === orderId ? selectedOrder.order.status : undefined);
    if (!previous || previous === status || pendingStatus.current.has(orderId)) return;
    let operationId: string;
    try { operationId = crypto.randomUUID(); } catch { setStatusError("تعذر بدء تحديث آمن للحالة."); return; }
    pendingStatus.current.set(orderId, status); ordersRevision.current += 1;
    setUpdatingIds(new Set(pendingStatus.current.keys())); setStatusError("");
    setOrders((list) => list.map((order) => order.id === orderId ? { ...order, status } : order));
    setSelectedOrder((detail) => detail?.order.id === orderId ? { ...detail, order: { ...detail.order, status } } : detail);
    void resolveStatus(orderId, previous, status, operationId);
  };

  const retryStatus = (orderId: number) => {
    const pending = uncertainStatuses.current.get(orderId);
    if (pending) void resolveStatus(orderId, pending.previous, pending.requested, pending.operationId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-editorial text-3xl text-[#111111]">إدارة الطلبات</h1>
        <p className="text-xs text-[#111111]/60 mt-1">
          متابعة الطلبات وتحديث حالات التجهيز والشحن والتسليم بالدينار العراقي ({orders.length} طلب)
        </p>
      </div>

      {notice && (
        <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <Check className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {statusError && <p role="alert" className="text-rose-700 text-xs">{statusError}</p>}

      {/* Search & Status Filters */}
      <div className="bg-white border border-[#D8C8B5]/70 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#111111]/45 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الطلب، اسم العميل، الهاتف، أو المحافظة..."
            className="w-full border border-[#D8C8B5] pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-[#111111]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-[#D8C8B5] px-3.5 py-2 text-xs bg-white"
        >
          <option value="all">جميع الحالات</option>
          {ALL_STATUSES.map((st) => (
            <option key={st} value={st}>
              {ORDER_STATUS_LABELS[st]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#D8C8B5]/70 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm text-[#111111]/60">
            <Loader2 className="w-5 h-5 animate-spin text-[#B79B6C]" />
            <span>جاري تحميل الطلبات...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-14 text-center text-sm text-[#111111]/60">
            لا توجد طلبات مطابقة لخيارات البحث.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#EFEAE2]/70 border-b border-[#D8C8B5] text-right">
                  <th className="py-3.5 px-4 font-semibold">رقم الطلب</th>
                  <th className="py-3.5 px-3 font-semibold">العميل</th>
                  <th className="py-3.5 px-3 font-semibold">المنتجات</th>
                  <th className="py-3.5 px-3 font-semibold">الإجمالي</th>
                  <th className="py-3.5 px-3 font-semibold">الدفع</th>
                  <th className="py-3.5 px-3 font-semibold">الحالة</th>
                  <th className="py-3.5 px-3 font-semibold">التاريخ</th>
                  <th className="py-3.5 px-4 font-semibold">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8C8B5]/50">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-[#F7F4EF]/50">
                    <td className="py-3.5 px-4 font-bold text-[#111111] whitespace-nowrap">
                      {o.order_number}
                    </td>
                    <td className="py-3.5 px-3">
                      <p className="font-semibold text-[#111111]">
                        {o.customer_name}
                      </p>
                      <p className="text-[11px] text-[#111111]/55">
                        {o.governorate} • {o.customer_phone}
                      </p>
                    </td>
                    <td className="py-3.5 px-3">{o.items_count || 1} قطعة</td>
                    <td className="py-3.5 px-3 font-bold whitespace-nowrap">
                      {formatIQD(o.total_iqd)}
                    </td>
                    <td className="py-3.5 px-3 text-[#111111]/75">
                      {o.payment_method}
                    </td>
                    <td className="py-3.5 px-3">
                      <select
                        value={o.status}
                        disabled={updatingIds.has(o.id)}
                        onChange={(e) => updateStatus(o.id, e.target.value)}
                        className={`px-2 py-1 border text-[11px] font-semibold cursor-pointer ${
                          ORDER_STATUS_STYLES[o.status] || "bg-white"
                        }`}
                      >
                        {ALL_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {ORDER_STATUS_LABELS[st]}
                          </option>
                        ))}
                      </select>
                      {uncertainIds.has(o.id) && <div role="alert" className="mt-1 text-rose-700">الحالة غير مؤكدة <button type="button" className="underline" onClick={() => retryStatus(o.id)}>إعادة التحقق</button></div>}
                      {updatingIds.has(o.id) && !uncertainIds.has(o.id) && <span className="text-xs"> جاري التأكيد...</span>}
                    </td>
                    <td className="py-3.5 px-3 text-[#111111]/65 whitespace-nowrap">
                      {formatArabicDateTime(o.created_at)}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => openOrderDetail(o.id)}
                        className="px-3 py-1.5 border border-[#D8C8B5] hover:border-[#111111] text-xs font-medium inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#111111]/60 backdrop-blur-xs"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-[#D8C8B5] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8C8B5]">
              <div>
                <h2 className="text-lg font-bold text-[#111111]">
                  تفاصيل الطلب: {selectedOrder.order.order_number}
                </h2>
                <p className="text-xs text-[#111111]/60">
                  {formatArabicDateTime(selectedOrder.order.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#F7F4EF] p-4 border border-[#D8C8B5]/60">
              <div className="space-y-1">
                <p className="text-[#B79B6C] font-semibold">بيانات العميل</p>
                <p className="font-bold text-[#111111]">
                  {selectedOrder.order.customer_name}
                </p>
                <p>{selectedOrder.order.customer_phone}</p>
                {selectedOrder.order.customer_email && (
                  <p>{selectedOrder.order.customer_email}</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[#B79B6C] font-semibold">عنوان التوصيل</p>
                <p className="font-bold text-[#111111]">
                  {selectedOrder.order.governorate} — {selectedOrder.order.city}
                </p>
                <p>{selectedOrder.order.address}</p>
                {selectedOrder.order.notes && (
                  <p className="text-amber-800 pt-1">
                    ملاحظات: {selectedOrder.order.notes}
                  </p>
                )}
              </div>
            </div>

            <button type="button" disabled={exporting} onClick={() => void exportOrderPdf(selectedOrder.order.id)} className="inline-flex items-center gap-2 border border-[#111111] px-4 py-2 text-xs disabled:opacity-50">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {exporting ? "جاري إنشاء PDF..." : "تنزيل تفاصيل الطلب PDF"}
            </button>
            {exportError && <p role="alert" className="text-sm text-rose-700">{exportError}</p>}

            {/* Status Update */}
            <div className="flex items-center justify-between gap-3 bg-[#EFEAE2]/60 p-3.5 border border-[#D8C8B5]/60">
              <span className="text-xs font-semibold">تحديث حالة الطلب: {uncertainIds.has(selectedOrder.order.id) && <><span className="text-rose-700">غير مؤكدة </span><button type="button" className="underline" onClick={() => retryStatus(selectedOrder.order.id)}>إعادة التحقق</button></>}</span>
              <select
                value={selectedOrder.order.status}
                disabled={updatingIds.has(selectedOrder.order.id)}
                onChange={(e) =>
                  updateStatus(selectedOrder.order.id, e.target.value)
                }
                className="bg-white border border-[#111111] px-3 py-1.5 text-xs font-semibold"
              >
                {ALL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {ORDER_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            {/* Items */}
            <div className="divide-y divide-[#D8C8B5]/50 border-y border-[#D8C8B5]/50">
              {selectedOrder.items.map((it) => (
                <div key={it.id} className="py-3 flex items-center gap-3.5 text-xs">
                  <img
                    src={it.product_image || "/images/brand-story.jpg"}
                    alt={it.product_name}
                    className="w-12 h-14 object-cover bg-[#EFEAE2]"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-[#111111]">
                      {it.product_name}
                    </p>
                    <p className="text-[#111111]/60">
                      {it.product_sku} {it.variant_label ? `• ${it.variant_label}` : ""}
                    </p>
                    <p className="text-[#111111]/65 mt-0.5">
                      {it.quantity} × {formatIQD(it.unit_price_iqd)}
                    </p>
                  </div>
                  <span className="font-bold text-[#111111]">
                    {formatIQD(it.total_price_iqd)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 text-xs max-w-xs mr-auto">
              <div className="flex justify-between">
                <span>المجموع الفرعي</span>
                <span>{formatIQD(selectedOrder.order.subtotal_iqd)}</span>
              </div>
              <div className="flex justify-between">
                <span>الشحن</span>
                <span>
                  {selectedOrder.order.shipping_iqd === 0
                    ? "مجاني"
                    : formatIQD(selectedOrder.order.shipping_iqd)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 border-t border-[#D8C8B5]">
                <span>الإجمالي</span>
                <span>{formatIQD(selectedOrder.order.total_iqd)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
