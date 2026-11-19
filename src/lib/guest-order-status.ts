// Only statuses persisted by the existing order system are shown; do not infer
// delivery stages the database does not record.
export const GUEST_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "تم استلام الطلب",
  confirmed: "تمت مراجعة الطلب",
  processing: "جاري تجهيز الطلب",
  shipped: "تم تسليم الطلب للتوصيل",
  delivered: "تم التسليم",
  cancelled: "تم الإلغاء",
};
