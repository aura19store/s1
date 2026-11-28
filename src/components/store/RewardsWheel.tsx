"use client";

import { useEffect, useState } from "react";
import { formatIQD } from "@/lib/format";

type WheelState = {
  enabled: boolean;
  required_orders: number;
  delivered_orders: number;
  earned_spins: number;
  used_spins: number;
  available_spins: number;
  customer_id: number | null;
};

type WheelResult = {
  prize_id: number;
  name: string;
  kind: "credit" | "product" | "gift";
  value_iqd: number;
  image_url: string | null;
};

export function RewardsWheel() {
  const [wheel, setWheel] = useState<WheelState | null>(null);
  const [prizes, setPrizes] = useState<any[]>([]); const [rotation, setRotation] = useState(0); const [wheelSpinning, setWheelSpinning] = useState(false);
  const [result, setResult] = useState<WheelResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState("");

  async function loadWheel() {
    try {
      const response = await fetch("/api/store/rewards/wheel", {
        cache: "no-store",
      });

      if (!response.ok) throw new Error();

      const data = await response.json();
      setWheel(data.wheel);
      setPrizes(data.prizes || []);
      setError("");
    } catch {
      setError("تعذر تحميل بيانات المكافآت.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWheel();
    const refresh = () => { if (!wheelSpinning && !spinning) void loadWheel(); };
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [wheelSpinning, spinning]);

  async function spin() {
    if (spinning || wheelSpinning || !wheel || wheel.available_spins <= 0 || prizes.length === 0) return;

    setSpinning(true);
    setWheelSpinning(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/store/rewards/wheel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "تعذر تشغيل العجلة.");
      }

      setResult(data.result);
      setWheel(data.wheel);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "تعذر تشغيل العجلة."
      );
      await loadWheel();
    } finally {
      setSpinning(false);
    }
  }

  if (loading) {
    return (
      <section className="bg-white border border-[#D8C8B5] p-5" dir="rtl">
        <p>جاري تحميل المكافآت…</p>
      </section>
    );
  }

  if (!wheel) return null;

  const progress = Math.min(
    wheel.delivered_orders % wheel.required_orders,
    wheel.required_orders
  );

  const progressForDisplay =
    wheel.available_spins > 0 ||
    wheel.delivered_orders >= wheel.required_orders
      ? wheel.required_orders
      : progress;

  const progressPercent =
    (progressForDisplay / wheel.required_orders) * 100;

  return (
    <section
      className="bg-white border border-[#D8C8B5] p-5 space-y-5"
      dir="rtl"
      aria-label="مكافآت العملاء"
    >
      <div className="space-y-1">
        <p className="text-sm text-[#777]">مكافآت العملاء</p>
        <h2 className="font-editorial text-2xl">
          عجلة المكافآت
        </h2>
      </div>

      {!wheel.enabled ? (
        <p className="text-sm text-[#777]">
          ستظهر مكافآتك هنا عند تفعيل البرنامج.
        </p>
      ) : (
        <>
          {prizes.length > 0 && (
            <div className="flex justify-center py-4">
              <div className="relative w-72 h-72 rounded-full border-8 border-[#D8C8B5] bg-[#F7F4EF] shadow-lg overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-[#111111] text-[#F7F4EF] flex items-center justify-center text-sm">مكافأة</div>
                </div>
                {prizes.map((prize, index) => {
                  const angle = (index * 360) / prizes.length;
                  return <div key={prize.id} className="absolute left-1/2 top-1/2 origin-left w-[45%] text-center text-xs font-semibold" style={{ transform: "rotate(" + angle + "deg) translateX(8%)" }}><span className="block truncate">{prize.name}</span></div>;
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>التقدم نحو الفرصة التالية</span>
              <strong>
                {progressForDisplay}/{wheel.required_orders}
              </strong>
            </div>

            <div
              className="h-2 bg-[#EEE7DF] overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={wheel.required_orders}
              aria-valuenow={progressForDisplay}
            >
              <div
                className="h-full bg-[#111111] transition-all duration-500"
                style={{ width: progressPercent + "%" }}
              />
            </div>
          </div>

          {wheel.delivered_orders === 0 ? (
            <p className="text-sm text-[#555]">
              لديك 0 طلبات مسلّمة. أكمل 5 طلبات مسلّمة لتحصل على
              فرصة لتدوير العجلة.
            </p>
          ) : wheel.available_spins > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-[#555]">
                لديك {wheel.available_spins} فرصة متاحة لتدوير العجلة.
              </p>

              <button
                type="button"
                onClick={spin}
                disabled={spinning}
                className="w-full min-h-12 bg-[#111111] text-[#F7F4EF] px-5 disabled:opacity-50"
              >
                {spinning ? "جاري الدوران…" : "أدر العجلة"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-[#555]">
              لديك {wheel.delivered_orders} طلبات مسلّمة.
              أكمل طلباتك حتى تصل إلى {wheel.required_orders}
              لتحصل على فرصة جديدة.
            </p>
          )}

          {result && (
            <div className="border border-[#D8C8B5] bg-[#F7F4EF] p-5 text-center space-y-2">
              <p className="text-sm text-[#777]">
                مبروك 🎉
              </p>

              <h3 className="font-editorial text-2xl">
                {result.name}
              </h3>

              {result.kind === "credit" && result.value_iqd > 0 && (
                <p className="font-semibold">
                  قيمة المكافأة: {formatIQD(result.value_iqd)}
                </p>
              )}

              <p className="text-sm text-[#555]">
                تم تسجيل مكافأتك بنجاح.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}