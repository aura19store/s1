import { NextRequest, NextResponse } from "next/server";
import { getGenderBySlug, queryStoreProducts } from "@/lib/store-queries";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const genderSlug = sp.get("gender") || "men";
    const q = (sp.get("q") || "").trim();

    const gender = getGenderBySlug(genderSlug);
    if (!gender) {
      return NextResponse.json({ products: [], total: 0 });
    }

    if (!q) {
      const popular = queryStoreProducts({
        genderId: gender.id,
        sort: "bestselling",
        limit: 4,
      });
      return NextResponse.json({
        products: popular.products,
        total: popular.total,
        isSuggestion: true,
      });
    }

    const res = queryStoreProducts({
      genderId: gender.id,
      search: q,
      limit: 8,
    });

    return NextResponse.json({
      products: res.products,
      total: res.total,
      isSuggestion: false,
    });
  } catch (err) {
    console.error("Search API error:", err);
    return NextResponse.json(
      { error: "تعذر إتمام البحث حاليًا." },
      { status: 500 }
    );
  }
}
