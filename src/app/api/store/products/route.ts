import { NextRequest, NextResponse } from "next/server";
import {
  getDynamicFiltersForGender,
  getGenderBySlug,
  queryStoreProducts,
} from "@/lib/store-queries";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const genderSlug = sp.get("gender") || "men";
    const gender = await getGenderBySlug(genderSlug);
    if (!gender) {
      return NextResponse.json(
        { error: "القسم المطلوب غير متوفر." },
        { status: 404 }
      );
    }

    const categorySlug = sp.get("category") || undefined;
    const search = sp.get("q") || undefined;
    const collection = sp.get("collection") || undefined;
    const minPriceRaw = sp.get("minPrice");
    const maxPriceRaw = sp.get("maxPrice");
    const minPrice = minPriceRaw ? Number(minPriceRaw) : undefined;
    const maxPrice = maxPriceRaw ? Number(maxPriceRaw) : undefined;
    const availability = (sp.get("availability") || "") as
      | "in_stock"
      | "out_of_stock"
      | "";
    const sort = sp.get("sort") || "featured";
    const page = Number(sp.get("page") || "1");
    const limit = Number(sp.get("limit") || "12");

    // Extract dynamic attr_* parameters
    const attributes: Record<string, string[]> = {};
    for (const [key, val] of sp.entries()) {
      if (key.startsWith("attr_") && val) {
        const attrSlug = key.slice(5);
        attributes[attrSlug] = val
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
      }
    }

    const [result, filters] = await Promise.all([
      queryStoreProducts({
        genderId: gender.id,
        categorySlug,
        search,
        collection,
        minPrice,
        maxPrice,
        availability,
        attributes,
        sort,
        page,
        limit,
      }),
      getDynamicFiltersForGender(gender.id, categorySlug),
    ]);

    return NextResponse.json({
      ...result,
      filters,
      gender,
    });
  } catch (err) {
    console.error("Store products API error:", err);
    return NextResponse.json(
      { error: "حدث خطأ أثناء تحميل المنتجات، يرجى المحاولة مجددًا." },
      { status: 500 }
    );
  }
}
