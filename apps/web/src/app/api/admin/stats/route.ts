import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRepo } from "@/lib/repo";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  if (!verifyAdminToken(cookies().get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "locked" }, { status: 401 });
  }
  const stats = await getRepo().stats();
  return NextResponse.json({ ok: true, stats });
}
