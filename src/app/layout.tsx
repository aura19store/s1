import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getRenderStoreSettings as getStoreSettings } from "@/lib/store-render-queries";
import { PwaInstall } from "@/components/store/PwaInstall";
import splashDevices from "@/lib/pwa-splash-devices.json";

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
    <html lang="ar" dir="rtl" suppressHydrationWarning style={{ backgroundColor: "#F7F4EF" }}>
      <head>
        {/* Initial home document only; the store loads underneath and the scene never blocks input. */}
        <script dangerouslySetInnerHTML={{ __html: "if(location.pathname==='/'&&!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)){document.documentElement.dataset.auraBoot='';if(navigator.deviceMemory&&navigator.deviceMemory<=2)document.documentElement.dataset.auraLite='';setTimeout(function(){delete document.documentElement.dataset.auraBoot;delete document.documentElement.dataset.auraLite},1500)}" }} />
        {/* Static head tags must not be streamed into the body after metadata. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/aura.svg" type="image/svg+xml" />
        <link rel="icon" href="/icons/aura-32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/aura-180.png" sizes="180x180" />
        <meta name="application-name" content="AURA" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="AURA" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="bg-[#F7F4EF] text-[#111111] antialiased selection:bg-[#B79B6C] selection:text-[#111111]">
        {children}
        <PwaInstall />
      </body>
    </html>
  );
}
