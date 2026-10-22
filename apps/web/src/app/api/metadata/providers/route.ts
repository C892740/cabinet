import { NextResponse } from "next/server";
import { providersStatus } from "@/lib/metadata";

export const runtime = "nodejs";

/** Which metadata providers are configured (booleans only — no secrets leak). */
export async function GET() {
  return NextResponse.json({ ok: true, providers: providersStatus() });
}
