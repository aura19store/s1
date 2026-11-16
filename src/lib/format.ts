// تنسيق العملة العراقية (الدينار العراقي فقط) والتواريخ العربية

export function formatIQD(amount: number | null | undefined): string {
  const safe = Number.isFinite(Number(amount)) ? Math.round(Number(amount)) : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(safe);
  return `${formatted} د.ع`;
}

export function formatNumber(value: number | null | undefined): string {
  const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatArabicDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function formatArabicDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ar-IQ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `item-${Date.now()}`;
}

export function discountPercent(original: number, finalPrice: number): number {
  if (original <= 0 || finalPrice >= original) return 0;
  return Math.round(((original - finalPrice) / original) * 100);
}
