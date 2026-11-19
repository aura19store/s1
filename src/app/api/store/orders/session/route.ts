import { NextRequest, NextResponse } from "next/server";
import { browserToken, browserTokenOrNew, setBrowserToken } from "@/lib/guest-order-access";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const response = NextResponse.json({ ready: Boolean(browserToken(request)) }, { headers: { "Cache-Control": "no-store" } });
  setBrowserToken(response, request, browserTokenOrNew(request));
  return response;
}
