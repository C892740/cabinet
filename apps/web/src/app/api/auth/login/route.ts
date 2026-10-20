import { NextResponse } from "next/server";
import { authenticate, startSession } from "@/lib/auth";
import { clientIp, isSameOriginRequest, rateLimit } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!rateLimit(`login:${clientIp(request)}`, 10, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again soon." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  const user = await authenticate({
    email: body?.email?.trim().toLowerCase() ?? "",
    password: body?.password ?? "",
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }

  await startSession(user);
  return NextResponse.json({ ok: true, user });
}
