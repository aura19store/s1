import { NextRequest, NextResponse } from "next/server";
import { queryAll, queryOne, runTransaction } from "@/db";
import { getDatabaseDriver } from "@/db";
import { browserToken } from "@/lib/guest-order-access";
import { hashToken } from "@/lib/password";
import { isSameOriginCustomerRequest } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

type CustomerIdentity = {
  customer_id: number;
  customer_count: number;
};

type WheelPrize = {
  id: number;
  name: string;
  kind: "credit" | "product" | "gift";
  value_iqd: number;
  image_url: string | null;
  probability: number;
  stock_quantity: number | null;
  sequence_position: number;
};

type WheelState = {
  enabled: boolean;
  required_orders: number;
  delivered_orders: number;
  earned_spins: number;
  used_spins: number;
  available_spins: number;
  customer_id: number | null;
};

const reply = (
  body: Record<string, unknown>,
  status = 200
) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

async function getCustomerIdentity(browser: string | null) {
  if (!browser) return null;

  const rows = await queryAll<{ customer_id: number | null }>(
    `SELECT DISTINCT o.customer_id
     FROM orders o
     JOIN guest_order_access a ON a.order_id = o.id
     WHERE a.browser_hash = ?
       AND o.customer_id IS NOT NULL
       AND CURRENT_TIMESTAMP IS NOT NULL`,
    hashToken(browser)
  );

  const ids = rows
    .map((row) => Number(row.customer_id))
    .filter((id) => Number.isInteger(id) && id > 0);

  const unique = [...new Set(ids)];

  if (unique.length !== 1) return null;

  return {
    customer_id: unique[0],
    customer_count: unique.length,
  } satisfies CustomerIdentity;
}

async function getPublicWheelPrizes() {
  return queryAll<{
    id: number;
    name: string;
    kind: "credit" | "product" | "gift";
    image_url: string | null;
    sequence_position: number;
  }>(
    `SELECT id, name, kind, image_url, sequence_position
     FROM aura_wheel_prizes
     WHERE active = 1
     ORDER BY sequence_position, id`
  );
}

async function getWheelState(browser: string | null): Promise<WheelState> {
  const settings = await queryOne<{
    enabled: number;
    required_orders: number;
  }>(
    `SELECT enabled, required_orders
     FROM aura_wheel_settings
     WHERE id = 1`
  );

  const enabled = Number(settings?.enabled ?? 0) === 1;
  const requiredOrders = Math.max(
    1,
    Number(settings?.required_orders ?? 5)
  );

  const identity = await getCustomerIdentity(browser);

  if (!identity) {
    return {
      enabled,
      required_orders: requiredOrders,
      delivered_orders: 0,
      earned_spins: 0,
      used_spins: 0,
      available_spins: 0,
      customer_id: null,
    };
  }

  const delivered = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM orders
     WHERE customer_id = ?
       AND status = 'delivered'`,
    identity.customer_id
  );

  const used = await queryOne<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM aura_wheel_spins
     WHERE customer_id = ?`,
    identity.customer_id
  );

  const deliveredOrders = Number(delivered?.count ?? 0);
  const usedSpins = Number(used?.count ?? 0);
  const earnedSpins = Math.floor(deliveredOrders / requiredOrders);
  const availableSpins = Math.max(0, earnedSpins - usedSpins);

  return {
    enabled,
    required_orders: requiredOrders,
    delivered_orders: deliveredOrders,
    earned_spins: earnedSpins,
    used_spins: usedSpins,
    available_spins: availableSpins,
    customer_id: identity.customer_id,
  };
}

function secureRandomUnit() {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 4294967296;
}

function choosePrize(prizes: WheelPrize[]) {
  const total = prizes.reduce(
    (sum, prize) => sum + Number(prize.probability),
    0
  );

  if (total <= 0) return null;

  let target = secureRandomUnit() * total;

  for (const prize of prizes) {
    target -= Number(prize.probability);

    if (target < 0) {
      return prize;
    }
  }

  return prizes[prizes.length - 1] ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const state = await getWheelState(browserToken(request));

    return reply({
      wheel: state,
      prizes: await getPublicWheelPrizes(),
    });
  } catch {
    return reply(
      {
        error: "Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜ÂªÃ˜Â­Ã™â€¦Ã™Å Ã™â€ž Ã˜Â¨Ã™Å Ã˜Â§Ã™â€ Ã˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â¬Ã™â€žÃ˜Â©.",
      },
      503
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginCustomerRequest(request)) {
    return reply(
      {
        error: "Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨ Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜Â³Ã™â€¦Ã™Ë†Ã˜Â­.",
      },
      403
    );
  }

  const browser = browserToken(request);

  if (!browser) {
    return reply(
      {
        error: "Ã™â€žÃ˜Â§ Ã™Å Ã™â€¦Ã™Æ’Ã™â€  Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Å Ã™â€ž Ã™â€žÃ™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â·Ã™â€žÃ˜Â¨.",
      },
      401
    );
  }

  try {
    return await runTransaction(async (tx) => {
      const settings = await tx.queryOne<{
        enabled: number;
        required_orders: number;
      }>(
        getDatabaseDriver() === "postgres"
          ? `SELECT enabled, required_orders
             FROM aura_wheel_settings
             WHERE id = 1
             FOR UPDATE`
          : `SELECT enabled, required_orders
             FROM aura_wheel_settings
             WHERE id = 1`
      );

      const enabled = Number(settings?.enabled ?? 0) === 1;
      const requiredOrders = Math.max(
        1,
        Number(settings?.required_orders ?? 5)
      );

      if (!enabled) {
        return reply(
          {
            error: "Ã˜Â§Ã™â€žÃ˜Â¹Ã˜Â¬Ã™â€žÃ˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã™ÂÃ˜Â¹Ã™â€žÃ˜Â© Ã˜Â­Ã˜Â§Ã™â€žÃ™Å Ã™â€¹Ã˜Â§.",
          },
          409
        );
      }

      const identityRows = await tx.queryAll<{
        customer_id: number | null;
      }>(
        `SELECT DISTINCT o.customer_id
         FROM orders o
         JOIN guest_order_access a ON a.order_id = o.id
         WHERE a.browser_hash = ?
           AND o.customer_id IS NOT NULL
           AND CURRENT_TIMESTAMP IS NOT NULL`,
        hashToken(browser)
      );

      const customerIds = [
        ...new Set(
          identityRows
            .map((row) => Number(row.customer_id))
            .filter((id) => Number.isInteger(id) && id > 0)
        ),
      ];

      if (customerIds.length !== 1) {
        return reply(
          {
            error: "Ã™â€žÃ˜Â§ Ã™Å Ã™â€¦Ã™Æ’Ã™â€  Ã˜ÂªÃ˜Â­Ã˜Â¯Ã™Å Ã˜Â¯ Ã˜Â§Ã™â€žÃ˜Â¹Ã™â€¦Ã™Å Ã™â€ž Ã˜Â¨Ã˜Â´Ã™Æ’Ã™â€ž Ã˜Â¢Ã™â€¦Ã™â€  Ã™â€žÃ™â€¡Ã˜Â°Ã˜Â§ Ã˜Â§Ã™â€žÃ˜Â¯Ã™Ë†Ã˜Â±.",
          },
          409
        );
      }

      const customerId = customerIds[0];

      const delivered = await tx.queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM orders
         WHERE customer_id = ?
           AND status = 'delivered'`,
        customerId
      );

      const deliveredOrders = Number(delivered?.count ?? 0);
      const earnedSpins = Math.floor(deliveredOrders / requiredOrders);

      const used = await tx.queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM aura_wheel_spins
         WHERE customer_id = ?`,
        customerId
      );

      const usedSpins = Number(used?.count ?? 0);
      const availableSpins = Math.max(
        0,
        earnedSpins - usedSpins
      );

      if (availableSpins <= 0) {
        return reply(
          {
            error: "Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã™â€žÃ˜Â¯Ã™Å Ã™Æ’ Ã™ÂÃ˜Â±Ã˜ÂµÃ˜Â© Ã˜Â¯Ã™Ë†Ã˜Â±Ã˜Â§Ã™â€  Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â­Ã˜Â© Ã˜Â­Ã˜Â§Ã™â€žÃ™Å Ã™â€¹Ã˜Â§.",
          },
          409
        );
      }

      const prizes = await tx.queryAll<WheelPrize>(
        `SELECT id, name, kind, value_iqd, image_url, probability,
                stock_quantity, sequence_position
         FROM aura_wheel_prizes
         WHERE active = 1
         ORDER BY sequence_position, id`
      );

      if (!prizes.length) {
        return reply(
          {
            error: "Ã™â€žÃ˜Â§ Ã˜ÂªÃ™Ë†Ã˜Â¬Ã˜Â¯ Ã˜Â¬Ã™Ë†Ã˜Â§Ã˜Â¦Ã˜Â² Ã™â€¦Ã˜ÂªÃ˜Â§Ã˜Â­Ã˜Â© Ã™â€žÃ™â€žÃ˜Â¹Ã˜Â¬Ã™â€žÃ˜Â© Ã˜Â­Ã˜Â§Ã™â€žÃ™Å Ã™â€¹Ã˜Â§.",
          },
          409
        );
      }

      const totalProbability = prizes.reduce(
        (sum, prize) => sum + Number(prize.probability),
        0
      );

      if (totalProbability <= 0 || Math.abs(totalProbability - 100) > 0.0001) {
        return reply(
          {
            error: "Ã˜Â¥Ã˜Â¹Ã˜Â¯Ã˜Â§Ã˜Â¯Ã˜Â§Ã˜Âª Ã˜Â§Ã˜Â­Ã˜ÂªÃ™â€¦Ã˜Â§Ã™â€žÃ˜Â§Ã˜Âª Ã˜Â§Ã™â€žÃ˜Â¬Ã™Ë†Ã˜Â§Ã˜Â¦Ã˜Â² Ã˜ÂºÃ™Å Ã˜Â± Ã˜ÂµÃ˜Â§Ã™â€žÃ˜Â­Ã˜Â©.",
          },
          409
        );
      }

      const prize = choosePrize(prizes);

      if (!prize) {
        return reply(
          {
            error: "Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜Â§Ã˜Â®Ã˜ÂªÃ™Å Ã˜Â§Ã˜Â± Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â§Ã˜Â¦Ã˜Â²Ã˜Â©.",
          },
          503
        );
      }

      if (
        prize.stock_quantity !== null &&
        Number(prize.stock_quantity) <= 0
      ) {
        return reply(
          {
            error: "Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â§Ã˜Â¦Ã˜Â²Ã˜Â© Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â®Ã˜ÂªÃ˜Â§Ã˜Â±Ã˜Â© Ã˜ÂºÃ™Å Ã˜Â± Ã™â€¦Ã˜ÂªÃ™Ë†Ã™ÂÃ˜Â±Ã˜Â© Ã˜Â­Ã˜Â§Ã™â€žÃ™Å Ã™â€¹Ã˜Â§.",
          },
          409
        );
      }

      if (getDatabaseDriver() === "postgres") {
        await tx.queryOne(
          `SELECT id
           FROM customers
           WHERE id = ?
           FOR UPDATE`,
          customerId
        );
      }

      const latestUsed = await tx.queryOne<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM aura_wheel_spins
         WHERE customer_id = ?`,
        customerId
      );

      const latestUsedSpins = Number(latestUsed?.count ?? 0);

      const latestAvailable =
        Math.floor(deliveredOrders / requiredOrders) -
        latestUsedSpins;

      if (latestAvailable <= 0) {
        return reply(
          {
            error: "Ã˜ÂªÃ™â€¦ Ã˜Â§Ã˜Â³Ã˜ÂªÃ˜Â®Ã˜Â¯Ã˜Â§Ã™â€¦ Ã™ÂÃ˜Â±Ã˜ÂµÃ˜Â© Ã˜Â§Ã™â€žÃ˜Â¯Ã™Ë†Ã˜Â±Ã˜Â§Ã™â€  Ã˜Â¨Ã˜Â§Ã™â€žÃ™ÂÃ˜Â¹Ã™â€ž.",
          },
          409
        );
      }

      if (prize.stock_quantity !== null) {
        const stockUpdate = await tx.execute(
          `UPDATE aura_wheel_prizes
           SET stock_quantity = stock_quantity - 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?
             AND stock_quantity > 0`,
          prize.id
        );

        if (!stockUpdate.changes) {
          return reply(
            {
              error: "Ã˜Â§Ã™â€žÃ˜Â¬Ã˜Â§Ã˜Â¦Ã˜Â²Ã˜Â© Ã™â€ Ã™ÂÃ˜Â¯Ã˜Âª Ã˜Â£Ã˜Â«Ã™â€ Ã˜Â§Ã˜Â¡ Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã˜Â§Ã™â€žÃ˜Â¯Ã™Ë†Ã˜Â±Ã˜Â§Ã™â€ .",
            },
            409
          );
        }
      }

      await tx.execute(
        `INSERT INTO aura_wheel_spins
          (customer_id, prize_id, qualifying_delivered_orders)
         VALUES (?, ?, ?)`,
        customerId,
        prize.id,
        deliveredOrders
      );

      return reply({
        result: {
          prize_id: prize.id,
          name: prize.name,
          kind: prize.kind,
          value_iqd: Number(prize.value_iqd),
          image_url: prize.image_url,
        },
        wheel: {
          enabled,
          required_orders: requiredOrders,
          delivered_orders: deliveredOrders,
          earned_spins: Math.floor(
            deliveredOrders / requiredOrders
          ),
          used_spins: latestUsedSpins + 1,
          available_spins: Math.max(
            0,
            latestAvailable - 1
          ),
          customer_id: customerId,
        },
      });
    });
  } catch {
    return reply(
      {
        error:
          "Ã˜ÂªÃ˜Â¹Ã˜Â°Ã˜Â± Ã˜ÂªÃ™â€ Ã™ÂÃ™Å Ã˜Â° Ã˜Â§Ã™â€žÃ˜Â¯Ã™Ë†Ã˜Â±Ã˜Â§Ã™â€  Ã˜Â­Ã˜Â§Ã™â€žÃ™Å Ã™â€¹Ã˜Â§. Ã™Å Ã˜Â±Ã˜Â¬Ã™â€° Ã˜Â§Ã™â€žÃ™â€¦Ã˜Â­Ã˜Â§Ã™Ë†Ã™â€žÃ˜Â© Ã™â€¦Ã˜Â±Ã˜Â© Ã˜Â£Ã˜Â®Ã˜Â±Ã™â€°.",
      },
      503
    );
  }
}