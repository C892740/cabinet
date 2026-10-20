import { NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/admin";
import { clientIp, isSameOriginRequest, rateLimit } from "@/lib/security";
import { ADMIN_COOKIE, adminMaxAgeSeconds, issueAdminToken, setCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  // Brute-force protection: a handful of attempts per IP per minute.
  if (!rateLimit(`admin:${clientIp(request)}`, 8, 60_000)) {
    return NextResponse.json({ ok: false, error: "too-many-attempts" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { key?: string } | null;
  const key = body?.key ?? "";

  const check = await verifyAdminKey(key);
  if (!check.ok) {
    return NextResponse.json(
      { ok: false, error: check.reason ?? "bad-key" },
      { status: 401 },
    );
  }

  const { token } = issueAdminToken();
  setCookie(ADMIN_COOKIE, token, adminMaxAgeSeconds());
  return NextResponse.json({ ok: true });
}
