import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { queryAll, queryOne, runTransaction } from "@/db";
import { requireAdminApi } from "@/lib/auth";
import { isSameOriginCustomerRequest } from "@/lib/customer-auth";

const prizeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  kind: z.enum(["credit", "product", "gift"]),
  valueIqd: z.number().int().min(0).max(100000000),
  imageUrl: z.string().trim().max(2000).nullable(),
  probability: z.number().min(0).max(100),
  stockQuantity: z.number().int().min(0).max(1000000).nullable(),
  sequencePosition: z.number().int().min(0).max(1000000),
  active: z.boolean(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("settings"),
    enabled: z.boolean(),
    requiredOrders: z.number().int().min(1).max(1000),
  }),
  z.object({
    action: z.literal("create"),
    prize: prizeSchema,
  }),
  z.object({
    action: z.literal("update"),
    id: z.number().int().positive(),
    prize: prizeSchema,
  }),
  z.object({
    action: z.literal("delete"),
    id: z.number().int().positive(),
  }),
]);

const reply = (
  body: Record<string, unknown>,
  status = 200
) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

function isExactlyHundred(value: number) {
  return Math.abs(value - 100) <= 0.0001;
}

async function getActiveProbabilityTotal() {
  const row = await queryOne<{ total: number | null }>(
    `SELECT COALESCE(SUM(probability), 0) AS total
     FROM aura_wheel_prizes
     WHERE active = 1`
  );

  return Number(row?.total ?? 0);
}

export async function GET() {
  const auth = await requireAdminApi("customers");
  if ("error" in auth) return auth.error;

  try {
    const [settings, prizes] = await Promise.all([
      queryOne<{
        id: number;
        enabled: number;
        required_orders: number;
        updated_at: string;
      }>(
        `SELECT id, enabled, required_orders, updated_at
         FROM aura_wheel_settings
         WHERE id = 1`
      ),
      queryAll<{
        id: number;
        name: string;
        kind: "credit" | "product" | "gift";
        value_iqd: number;
        image_url: string | null;
        probability: number;
        stock_quantity: number | null;
        active: number;
        sequence_position: number;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT id, name, kind, value_iqd, image_url, probability,
                stock_quantity, active, sequence_position,
                created_at, updated_at
         FROM aura_wheel_prizes
         ORDER BY sequence_position, id`
      ),
    ]);

    const spins = await queryAll(`SELECT s.id, c.name AS customer_name, c.phone AS customer_phone, p.name AS prize_name, s.qualifying_delivered_orders, s.created_at FROM aura_wheel_spins s INNER JOIN customers c ON c.id = s.customer_id INNER JOIN aura_wheel_prizes p ON p.id = s.prize_id ORDER BY datetime(s.created_at) DESC, s.id DESC LIMIT 100`);

    const probabilityTotal = prizes.reduce(
      (sum, prize) => sum + Number(prize.probability),
      0
    );

    return reply({
      settings: settings ?? {
        id: 1,
        enabled: 0,
        required_orders: 5,
        updated_at: new Date().toISOString(),
      },
      prizes,
      probabilityTotal,
      probabilityValid: isExactlyHundred(probabilityTotal),
    });
  } catch {
    return reply(
      { error: "تعذر تحميل إعدادات عجلة المكافآت." },
      503
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("customers");
  if ("error" in auth) return auth.error;

  if (!isSameOriginCustomerRequest(request)) {
    return reply({ error: "الطلب غير مسموح." }, 403);
  }

  try {
    const parsed = actionSchema.safeParse(await request.json());

    if (!parsed.success) {
      return reply(
        { error: "بيانات المكافأة غير صالحة." },
        400
      );
    }

    const data = parsed.data;

    return await runTransaction(async (tx) => {
      if (data.action === "settings") {
        const currentPrizes = await tx.queryAll<{
          probability: number;
          active: number;
        }>(
          `SELECT probability, active
           FROM aura_wheel_prizes`
        );

        const total = currentPrizes
          .filter((prize) => Number(prize.active) === 1)
          .reduce(
            (sum, prize) => sum + Number(prize.probability),
            0
          );

        if (data.enabled && !isExactlyHundred(total)) {
          return reply(
            {
              error:
                "لا يمكن تفعيل العجلة. يجب أن يكون مجموع احتمالات الجوائز الفعالة 100٪ بالضبط.",
            },
            409
          );
        }

        await tx.execute(
          `INSERT INTO aura_wheel_settings
             (id, enabled, required_orders)
           VALUES (?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             enabled = excluded.enabled,
             required_orders = excluded.required_orders,
             updated_at = CURRENT_TIMESTAMP`,
          1,
          Number(data.enabled),
          data.requiredOrders
        );

        return reply({
          message: "تم حفظ إعدادات العجلة بنجاح.",
        });
      }

      let changedPrizeId: number | null = null;
      if (data.action === "create") {
        const prize = data.prize;

        if (
          prize.kind === "credit" &&
          prize.valueIqd <= 0
        ) {
          return reply(
            {
              error:
                "يجب تحديد قيمة مالية صحيحة للمكافأة المالية.",
            },
            400
          );
        }

        if (
          prize.kind !== "credit" &&
          prize.valueIqd !== 0
        ) {
          return reply(
            {
              error:
                "المكافآت غير المالية لا تحتاج إلى قيمة مالية.",
            },
            400
          );
        }

        const insertResult = await tx.execute(
          `INSERT INTO aura_wheel_prizes
             (name, kind, value_iqd, image_url, probability,
              stock_quantity, active, sequence_position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          prize.name,
          prize.kind,
          prize.valueIqd,
          prize.imageUrl,
          prize.probability,
          prize.stockQuantity,
          Number(prize.active),
          prize.sequencePosition
        );

        changedPrizeId = Number(insertResult.lastInsertRowid);
      }

      if (data.action === "update") {
        const prize = data.prize;

        if (
          prize.kind === "credit" &&
          prize.valueIqd <= 0
        ) {
          return reply(
            {
              error:
                "يجب تحديد قيمة مالية صحيحة للمكافأة المالية.",
            },
            400
          );
        }

        if (
          prize.kind !== "credit" &&
          prize.valueIqd !== 0
        ) {
          return reply(
            {
              error:
                "المكافآت غير المالية لا تحتاج إلى قيمة مالية.",
            },
            400
          );
        }

        const result = await tx.execute(
          `UPDATE aura_wheel_prizes
           SET name = ?,
               kind = ?,
               value_iqd = ?,
               image_url = ?,
               probability = ?,
               stock_quantity = ?,
               active = ?,
               sequence_position = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          prize.name,
          prize.kind,
          prize.valueIqd,
          prize.imageUrl,
          prize.probability,
          prize.stockQuantity,
          Number(prize.active),
          prize.sequencePosition,
          data.id
        );

        if (!result.changes) {
          return reply(
            { error: "المكافأة غير موجودة." },
            404
          );
        }
        changedPrizeId = data.id;
      }

      if (data.action === "delete") {
        const result = await tx.execute(
          `DELETE FROM aura_wheel_prizes
           WHERE id = ?`,
          data.id
        );

        if (!result.changes) {
          return reply(
            { error: "المكافأة غير موجودة." },
            404
          );
        }
        changedPrizeId = data.id;
      }

      const total = await tx.queryOne<{ total: number | null }>(
        `SELECT COALESCE(SUM(probability), 0) AS total
         FROM aura_wheel_prizes
         WHERE active = 1`
      );

      const probabilityTotal = Number(total?.total ?? 0);

      const settings = await tx.queryOne<{
        enabled: number;
      }>(
        `SELECT enabled
         FROM aura_wheel_settings
         WHERE id = 1`
      );

      if (
        Number(settings?.enabled ?? 0) === 1 &&
        !isExactlyHundred(probabilityTotal)
      ) {
        throw new Error("WHEEL_PROBABILITY_INVALID");
      }

      return reply({
        message: "تم حفظ التغييرات بنجاح.",
        probabilityTotal,
        probabilityValid: isExactlyHundred(
          probabilityTotal
        ),
        changedPrizeId,
    });
      });
  } catch (error) {
    if (error instanceof Error && error.message === "WHEEL_PROBABILITY_INVALID") {
      return reply(
        { error: "تعذر حفظ التغيير لأن مجموع احتمالات الجوائز الفعالة يجب أن يساوي 100٪ بالضبط." },
        409
      );
    }
    return reply(
      { error: "تعذر حفظ تغييرات عجلة المكافآت." },
      503
    );
  }
}
