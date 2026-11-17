import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getStoreSettings } from "@/lib/store-queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: {
      default: `${settings.store_name} | ${settings.tagline}`,
      template: `%s | ${settings.store_name}`,
    },
    description: `${settings.store_name} — ${settings.secondary_tagline} متجر إكسسوارات فاخرة للرجال والنساء في العراق.`,
    openGraph: {
      type: "website",
      locale: "ar_IQ",
      siteName: settings.store_name,
      title: `${settings.store_name} | ${settings.tagline}`,
      description: `${settings.secondary_tagline} تشكيلة فاخرة من الساعات والمجوهرات والحقائب والنظارات في العراق.`,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="bg-[#F7F4EF] text-[#111111] antialiased selection:bg-[#B79B6C] selection:text-[#111111]">
        {children}
      </body>
    </html>
  );
}
