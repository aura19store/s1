import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, queryAll, queryOne } from "@/db";
import { ensureGuestSessionToken, getGuestSessionToken } from "@/lib/auth";
import { getProductsByIds } from "@/lib/store-queries";

export async function GET(request: NextRequest) {
  const token = await getGuestSessionToken();
  const genderSlug = request.nextUrl.searchParams.get("gender");

  if (!token) {
    return NextResponse.json({ ids: [], products: [] });
  }

  const rows = queryAll<{ product_id: number }>(
    `SELECT product_id FROM wishlists WHERE session_token = ? ORDER BY created_at DESC`,
    token
  );
  const ids = rows.map((r) => r.product_id);
  let products = getProductsByIds(ids);

  if (genderSlug) {
    products = products.filter((p) => p.gender_slug === genderSlug);
  }

  return NextResponse.json({
    ids: products.map((p) => p.id),
    allIds: ids,
    products,
  });
}

const toggleSchema = z.object({
  productId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = toggleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "معرف المنتج غير صالح." }, { status: 400 });
    }

    const token = await ensureGuestSessionToken();
    const existing = queryOne<{ id: number }>(
      `SELECT id FROM wishlists WHERE session_token = ? AND product_id = ?`,
      token,
      parsed.data.productId
    );

    let added = false;
    if (existing) {
      execute(`DELETE FROM wishlists WHERE id = ?`, existing.id);
    } else {
      const prod = queryOne<{ id: number }>(
        `SELECT id FROM products WHERE id = ? AND status = 'active'`,
        parsed.data.productId
      );
      if (!prod) {
        return NextResponse.json(
          { error: "المنتج غير متوفر." },
          { status: 404 }
        );
      }
      execute(
        `INSERT OR IGNORE INTO wishlists (session_token, product_id) VALUES (?, ?)`,
        token,
        parsed.data.productId
      );
      added = true;
    }

    const allRows = queryAll<{ product_id: number }>(
      `SELECT product_id FROM wishlists WHERE session_token = ?`,
      token
    );

    return NextResponse.json({
      added,
      guestToken: token,
      message: added
        ? "تمت إضافة المنتج إلى المفضلة."
        : "تمت إزالة المنتج من المفضلة.",
      allIds: allRows.map((r) => r.product_id),
    });
  } catch (err) {
    console.error("Wishlist error:", err);
    return NextResponse.json(
      { error: "تعذر تحديث قائمة المفضلة." },
      { status: 500 }
    );
  }
}
