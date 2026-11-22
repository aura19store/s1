import { NextResponse } from "next/server";
import { queryAll } from "@/db";
import { getCustomerUser } from "@/lib/customer-auth";

export async function GET() {
  try {
    const user = await getCustomerUser();

    if (!user || !user.email) {
      return NextResponse.json(
        { error: "يرجى تسجيل الدخول." },
        {
          status: 401,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    const orders = await queryAll<{
      id: number;
      order_number: string;
      status: string;
      subtotal_iqd: number;
      total_iqd: number;
      created_at: string;
    }>(
      `SELECT o.id, o.order_number, o.status, o.subtotal_iqd, o.total_iqd, o.created_at
       FROM customer_account_orders ao
       JOIN orders o ON o.id = ao.order_id
       WHERE ao.auth_user_id = ?
       ORDER BY o.created_at DESC, o.id DESC`,
      user.id
    );

    return NextResponse.json(
      {
        profile: {
          email: user.email,
          name:
            typeof user.user_metadata?.display_name === "string"
              ? user.user_metadata.display_name
              : "",
        },
        orders,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "تعذر تحميل الحساب حاليًا." },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  }
}