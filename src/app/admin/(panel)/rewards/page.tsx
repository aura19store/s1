"use client";

import React, { useCallback, useEffect, useState } from "react";
import { formatIQD } from "@/lib/format";

type PrizeKind = "credit" | "product" | "gift";

type Prize = {
  id: number;
  name: string;
  kind: PrizeKind;
  value_iqd: number;
  image_url: string | null;
  probability: number;
  stock_quantity: number | null;
  active: number;
  sequence_position: number;
};

type Snapshot = {
  spins: Array<{ id: number; customer_name: string; customer_phone: string; prize_name: string; qualifying_delivered_orders: number; created_at: string }>;
  settings: {
    id: number;
    enabled: number;
    required_orders: number;
    updated_at: string;
  };
  prizes: Prize[];
  probabilityTotal: number;
  probabilityValid: boolean;
};

const input =
  "w-full border border-[#D8C8B5] px-3 py-2 bg-white text-sm";

const kindLabels: Record<PrizeKind, string> = {
  credit: "رصيد مالي",
  product: "منتج",
  gift: "هدية",
};

export default function RewardsAdminPage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [required, setRequired] = useState("5");

  const [id, setId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PrizeKind>("credit");
  const [value, setValue] = useState("5000");
  const [imageUrl, setImageUrl] = useState("");
  const [probability, setProbability] = useState("10");
  const [stock, setStock] = useState("");
  const [position, setPosition] = useState("0");
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/admin/rewards",
        { cache: "no-store" }
      );

      const json = await response.json();

      if (!response.ok) {
        setMessage(
          json.error || "تعذر تحميل إعدادات العجلة."
        );
        return;
      }

      setData(json);
      setEnabled(Number(json.settings.enabled) === 1);
      setRequired(
        String(json.settings.required_orders)
      );
    } catch {
      setMessage("تعذر الاتصال بخدمة الإدارة.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/rewards",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        setMessage(json.error || "تعذر حفظ التغييرات.");
        return;
      }

      setMessage(json.message);

      const action = String(body.action || "");
      const prizePayload = body.prize as {
        name: string;
        kind: PrizeKind;
        valueIqd: number;
        imageUrl: string | null;
        probability: number;
        stockQuantity: number | null;
        sequencePosition: number;
        active: boolean;
      } | undefined;

      setData((current) => {
        if (!current) return current;

        if (action === "settings") {
          return {
            ...current,
            settings: {
              ...current.settings,
              enabled: Boolean(body.enabled) ? 1 : 0,
              required_orders: Number(body.requiredOrders),
            },
          };
        }

        const probabilityTotal =
          typeof json.probabilityTotal === "number"
            ? json.probabilityTotal
            : current.probabilityTotal;
        const probabilityValid =
          typeof json.probabilityValid === "boolean"
            ? json.probabilityValid
            : current.probabilityValid;

        if (action === "delete") {
          const deletedId = Number(body.id);
          return {
            ...current,
            prizes: current.prizes.filter(
              (prize) => Number(prize.id) !== deletedId
            ),
            probabilityTotal,
            probabilityValid,
          };
        }

        if (!prizePayload) return current;

        const prizeId = Number(
          json.changedPrizeId ?? body.id
        );
        const nextPrize: Prize = {
          id: prizeId,
          name: prizePayload.name,
          kind: prizePayload.kind,
          value_iqd: Number(prizePayload.valueIqd),
          image_url: prizePayload.imageUrl,
          probability: Number(prizePayload.probability),
          stock_quantity: prizePayload.stockQuantity == null ? null : Number(prizePayload.stockQuantity),
          active: prizePayload.active ? 1 : 0,
          sequence_position: Number(prizePayload.sequencePosition),
        };

        const prizes = action === "create"
          ? [...current.prizes, nextPrize]
          : current.prizes.map((prize) =>
              Number(prize.id) === prizeId ? nextPrize : prize
            );

        prizes.sort(
          (a, b) =>
            Number(a.sequence_position) - Number(b.sequence_position) ||
            Number(a.id) - Number(b.id)
        );

        return {
          ...current,
          prizes,
          probabilityTotal,
          probabilityValid,
        };
      });
    } catch {
      setMessage("تعذر الاتصال بخدمة الإدارة.");
    } finally {
      setBusy(false);
    }
  }

  function editPrize(prize: Prize) {
    setId(Number(prize.id));
    setName(prize.name);
    setKind(prize.kind);
    setValue(String(prize.value_iqd));
    setImageUrl(prize.image_url || "");
    setProbability(String(prize.probability));
    setStock(
      prize.stock_quantity == null
        ? ""
        : String(prize.stock_quantity)
    );
    setPosition(String(prize.sequence_position));
    setActive(Number(prize.active) === 1);
  }

  function clearForm() {
    setId(null);
    setName("");
    setKind("credit");
    setValue("5000");
    setImageUrl("");
    setProbability("10");
    setStock("");
    setPosition("0");
    setActive(true);
  }

  const probabilityTotal =
    data?.probabilityTotal ?? 0;

  const probabilityValid =
    data?.probabilityValid ?? false;

  return (
    <div
      className="space-y-8"
      dir="rtl"
    >
      <div>
        <h1 className="font-editorial text-3xl">
          عجلة المكافآت
        </h1>

        <p className="text-sm text-[#111111]/65 mt-2">
          إدارة المكافآت واحتمالات الفوز للعملاء.
        </p>
      </div>

      {message && (
        <p
          role="status"
          className="border border-[#D8C8B5] p-3 text-sm"
        >
          {message}
        </p>
      )}

      <section className="bg-white border border-[#D8C8B5] p-6">
        <h2 className="font-semibold mb-4">
          إعدادات العجلة
        </h2>

        <form
          className="grid gap-4 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();

            void save({
              action: "settings",
              enabled,
              requiredOrders: Number(required),
            });
          }}
        >
          <label className="text-sm">
            عدد الطلبات المسلّمة المطلوبة

            <input
              className={input}
              type="number"
              min="1"
              max="1000"
              value={required}
              onChange={(event) =>
                setRequired(event.target.value)
              }
              required
            />
          </label>

          <label className="text-sm flex gap-2 items-center">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) =>
                setEnabled(event.target.checked)
              }
            />

            العجلة مفعّلة
          </label>

          <button
            disabled={busy}
            className="bg-[#111111] text-white px-5 py-2 text-sm disabled:opacity-50"
          >
            حفظ الإعدادات
          </button>
        </form>
      </section>

      <section className="bg-white border border-[#D8C8B5] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-semibold">
              مجموع الاحتمالات
            </h2>

            <p className="text-sm text-[#111111]/65 mt-1">
              يجب أن يكون مجموع الجوائز الفعالة 100٪ بالضبط.
            </p>
          </div>

          <div
            className={
              probabilityValid
                ? "text-sm font-semibold"
                : "text-sm font-semibold text-red-700"
            }
          >
            {probabilityTotal.toFixed(2)}٪
            {probabilityValid
              ? " — صحيح"
              : " — غير مكتمل"}
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#D8C8B5] p-6">
        <h2 className="font-semibold mb-4">
          {id
            ? "تعديل مكافأة"
            : "إضافة مكافأة جديدة"}
        </h2>

        <form
          className="grid gap-4 md:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();

            void save({
              action: id ? "update" : "create",
              ...(id ? { id } : {}),
              prize: {
                name,
                kind,
                valueIqd:
                  kind === "credit"
                    ? Number(value)
                    : 0,
                imageUrl:
                  imageUrl.trim() || null,
                probability: Number(probability),
                stockQuantity:
                  stock.trim() === ""
                    ? null
                    : Number(stock),
                sequencePosition: Number(position),
                active,
              },
            });
          }}
        >
          <label className="text-sm">
            اسم المكافأة

            <input
              className={input}
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              maxLength={100}
              required
            />
          </label>

          <label className="text-sm">
            نوع المكافأة

            <select
              className={input}
              value={kind}
              onChange={(event) =>
                setKind(
                  event.target.value as PrizeKind
                )
              }
            >
              {Object.entries(kindLabels).map(
                ([key, label]) => (
                  <option
                    key={key}
                    value={key}
                  >
                    {label}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="text-sm">
            {kind === "credit"
              ? "قيمة المكافأة بالدينار"
              : "القيمة المالية"}

            <input
              className={input}
              type="number"
              min={kind === "credit" ? "1" : "0"}
              value={
                kind === "credit"
                  ? value
                  : "0"
              }
              onChange={(event) =>
                setValue(event.target.value)
              }
              disabled={kind !== "credit"}
              required
            />
          </label>

          <label className="text-sm">
            احتمال الفوز ٪

            <input
              className={input}
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={probability}
              onChange={(event) =>
                setProbability(event.target.value)
              }
              required
            />
          </label>

          <label className="text-sm">
            المخزون

            <input
              className={input}
              type="number"
              min="0"
              max="1000000"
              placeholder="فارغ = غير محدود"
              value={stock}
              onChange={(event) =>
                setStock(event.target.value)
              }
            />
          </label>

          <label className="text-sm">
            ترتيب الظهور

            <input
              className={input}
              type="number"
              min="0"
              value={position}
              onChange={(event) =>
                setPosition(event.target.value)
              }
              required
            />
          </label>

          <label className="text-sm">
            رابط صورة المكافأة

            <input
              className={input}
              value={imageUrl}
              onChange={(event) =>
                setImageUrl(event.target.value)
              }
              placeholder="اختياري"
              maxLength={2000}
            />
          </label>

          <label className="text-sm flex gap-2 items-center">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) =>
                setActive(event.target.checked)
              }
            />

            المكافأة فعّالة
          </label>

          <div className="flex items-center gap-3">
            <button
              disabled={busy}
              className="bg-[#111111] text-white px-5 py-2 text-sm disabled:opacity-50"
            >
              {id
                ? "حفظ التعديل"
                : "إضافة المكافأة"}
            </button>

            {id && (
              <button
                type="button"
                onClick={clearForm}
                className="text-sm underline"
              >
                إلغاء التعديل
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="bg-white border border-[#D8C8B5] p-6">
        <h2 className="font-semibold mb-4">
          الجوائز الحالية
        </h2>

        <div className="space-y-3">
          {data?.prizes.length === 0 ? (
            <p className="text-sm text-[#111111]/65">
              لا توجد جوائز مضافة حتى الآن.
            </p>
          ) : (
            data?.prizes.map((prize) => (
              <div
                key={prize.id}
                className="border-b border-[#D8C8B5]/50 py-4 flex flex-wrap justify-between gap-4"
              >
                <div className="text-sm space-y-1">
                  <p className="font-semibold">
                    {prize.name}
                  </p>

                  <p className="text-[#111111]/65">
                    {kindLabels[prize.kind]}
                    {" · "}
                    الاحتمال:{" "}
                    {Number(prize.probability).toFixed(2)}
                    ٪
                  </p>

                  {prize.kind === "credit" && (
                    <p>
                      القيمة:{" "}
                      {formatIQD(
                        Number(prize.value_iqd)
                      )}
                    </p>
                  )}

                  <p>
                    المخزون:{" "}
                    {prize.stock_quantity == null
                      ? "غير محدود"
                      : prize.stock_quantity}
                  </p>

                  <p>
                    الحالة:{" "}
                    {Number(prize.active) === 1
                      ? "فعّالة"
                      : "متوقفة"}
                  </p>
                </div>

                <div className="flex items-start gap-4 text-sm">
                  <button
                    type="button"
                    onClick={() =>
                      editPrize(prize)
                    }
                    className="underline"
                  >
                    تعديل
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "هل تريد حذف هذه المكافأة؟"
                        )
                      ) {
                        void save({
                          action: "delete",
                          id: Number(prize.id),
                        });
                      }
                    }}
                    className="underline disabled:opacity-40"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-black/10 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">سجل الفائزين</h2><p className="mt-1 text-sm opacity-70">آخر 100 عملية تدوير للعجلة.</p><div className="mt-5 overflow-x-auto">{data?.spins?.length ? (<table className="w-full min-w-[700px] text-right text-sm"><thead><tr className="border-b border-black/10"><th className="p-3">العميل</th><th className="p-3">الهاتف</th><th className="p-3">الجائزة</th><th className="p-3">الطلبات</th><th className="p-3">التاريخ</th></tr></thead><tbody>{data.spins.map((spin) => (<tr key={spin.id} className="border-b border-black/5"><td className="p-3 font-semibold">{spin.customer_name}</td><td className="p-3">{spin.customer_phone}</td><td className="p-3">{spin.prize_name}</td><td className="p-3">{spin.qualifying_delivered_orders}</td><td className="p-3">{new Date(spin.created_at).toLocaleString("ar-IQ")}</td></tr>))}</tbody></table>) : (<p className="py-8 text-center text-sm opacity-60">لا توجد عمليات فوز حتى الآن.</p>)}</div></section>
    </div>
  );
}