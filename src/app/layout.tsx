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
    <html lang="ar" dir="rtl" style={{ backgroundColor: "#F7F4EF" }}>
      <head>
        {/* Static head tags must not be streamed into the body after metadata. */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/aura.svg" type="image/svg+xml" />
        <link rel="icon" href="/icons/aura-32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/aura-180.png" sizes="180x180" />
        {splashDevices.flatMap(({ width, height, scale }) =>
          (["portrait", "landscape"] as const).map((orientation) => (
            <link
              key={`${width}x${height}@${scale}-${orientation}`}
              rel="apple-touch-startup-image"
              href={`/splash/${width}x${height}@${scale}-${orientation}.png`}
              media={`(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: ${orientation})`}
            />
          ))
        )}
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
