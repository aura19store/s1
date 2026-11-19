"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type IosNavigator = Navigator & { standalone?: boolean };

const DISMISSED_UNTIL = "aura-install-dismissed-until";
const REMIND_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as IosNavigator).standalone === true;
}

function isIos() {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isDeferred() {
  try { return Number(localStorage.getItem(DISMISSED_UNTIL) || 0) > Date.now(); }
  catch { return false; }
}

export function PwaInstall() {
  const pathname = usePathname();
  const storefront = !pathname.startsWith("/admin") && !pathname.startsWith("/account/recovery");
  const nativePrompt = useRef<InstallPromptEvent | null>(null);
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [ios, setIos] = useState(false);
  const [instructions, setInstructions] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refreshInstalled = () => setInstalled(isInstalled());
    const onInstall = (event: Event) => {
      event.preventDefault();
      nativePrompt.current = event as InstallPromptEvent;
      setAvailable(true);
    };
    const onInstalled = () => { nativePrompt.current = null; setAvailable(false); setInstalled(true); };
    refreshInstalled();
    setIos(isIos());
    setDismissed(isDeferred());
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", onInstalled);
    document.addEventListener("visibilitychange", refreshInstalled);
    const displays = ["standalone", "fullscreen"].map(mode => window.matchMedia(`(display-mode: ${mode})`));
    displays.forEach(display => display.addEventListener?.("change", refreshInstalled));
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", onInstalled);
      document.removeEventListener("visibilitychange", refreshInstalled);
      displays.forEach(display => display.removeEventListener?.("change", refreshInstalled));
    };
  }, []);

  useEffect(() => {
    if (storefront && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { /* Normal browsing remains available. */ });
    }
  }, [storefront]);

  const later = () => {
    try { localStorage.setItem(DISMISSED_UNTIL, String(Date.now() + REMIND_AFTER_MS)); } catch { /* Hide for this session. */ }
    setDismissed(true);
  };

  const install = async () => {
    if (ios && !nativePrompt.current) { setInstructions(true); return; }
    const prompt = nativePrompt.current;
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      nativePrompt.current = null;
      setAvailable(false);
      if (choice.outcome === "dismissed") later();
    } catch {
      nativePrompt.current = null;
      setAvailable(false);
    } finally { setBusy(false); }
  };

  if (!storefront || installed || dismissed || (!available && !ios)) return null;
  return (
    <section aria-label="تثبيت تطبيق AURA" dir="rtl" className="fixed z-[90] bottom-4 inset-x-4 sm:inset-x-auto sm:left-5 sm:w-[380px] bg-[#111111] text-[#F7F4EF] border border-[#B79B6C]/60 shadow-2xl p-5">
      <div className="flex items-start gap-4">
        <img src="/icons/aura-192.png" alt="" className="w-14 h-14 shrink-0 border border-[#B79B6C]/40" />
        <div className="min-w-0">
          <h2 className="font-editorial text-lg">متجر AURA على جهازك</h2>
          {instructions ? (
            <div role="status" className="text-xs leading-6 text-[#D8C8B5] mt-1">
              <p>لإضافة AURA إلى الشاشة الرئيسية:</p>
              <ol className="list-decimal list-inside">
                <li>افتح قائمة المشاركة في المتصفح (رمز المربع والسهم للأعلى).</li>
                <li>اختر «إضافة إلى الشاشة الرئيسية»، ثم اضغط «إضافة».</li>
              </ol>
              <p>إذا لم يظهر الخيار، افتح المتجر في Safari وحاول مجددًا.</p>
            </div>
          ) : (
            <p className="text-xs leading-6 text-[#D8C8B5] mt-1">ثبّت المتجر للوصول إليه بسهولة وتجربة تسوق مريحة.</p>
          )}
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button type="button" onClick={install} disabled={busy} className="min-h-11 flex-1 bg-[#B79B6C] text-[#111111] px-4 py-2 text-sm font-semibold disabled:opacity-60">تثبيت</button>
        <button type="button" onClick={later} className="min-h-11 flex-1 border border-[#D8C8B5]/50 px-4 py-2 text-sm font-semibold">لاحقاً</button>
      </div>
    </section>
  );
}
