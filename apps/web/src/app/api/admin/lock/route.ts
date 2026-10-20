import { NextResponse } from "next/server";
import { ADMIN_COOKIE, clearCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  clearCookie(ADMIN_COOKIE);
  return NextResponse.json({ ok: true });
}
