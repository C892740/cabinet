import { NextResponse } from "next/server";
import { registerUser, startSession } from "@/lib/auth";
import { isSameOriginRequest, rateLimit, clientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (!rateLimit(`register:${clientIp(request)}`, 5, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again soon." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    displayName?: string;
    password?: string;
  } | null;

  const email = body?.email?.trim().toLowerCase() ?? "";
  const displayName = body?.displayName?.trim() ?? "";
  const password = body?.password ?? "";

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
  }
  if (displayName.length < 2) {
    return NextResponse.json({ ok: false, error: "Display name must be at least 2 characters." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const user = await registerUser({ email, displayName, password });
    await startSession(user);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not create account." },
      { status: 400 },
    );
  }
}
