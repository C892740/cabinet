import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import { getCloudRepo } from "@/lib/cloud-repo";

export const runtime = "nodejs";

/**
 * Netplay rooms. The host creates a room and shares its 5-character code;
 * guests look the room up before posting signalling messages to
 * /api/netplay/[code]/signal. Game traffic never flows through here — only
 * WebRTC signalling, over polling (serverless-friendly).
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    romId?: string;
    gameTitle?: string;
    core?: string;
  } | null;

  const session = await getCloudRepo().createNetplaySession({
    hostUserId: user.id,
    hostName: user.displayName,
    gameTitle: (body?.gameTitle ?? "Netplay session").slice(0, 200),
    core: (body?.core ?? "").slice(0, 32),
    romId: body?.romId ?? null,
  });
  return NextResponse.json({ ok: true, session }, { status: 201 });
}

/** Look up a room by code (guests join with this). */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim() ?? "";
  if (!/^[A-Za-z0-9]{4,8}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "invalid code" }, { status: 400 });
  }
  const session = await getCloudRepo().getNetplaySession(code);
  if (!session) return NextResponse.json({ ok: false, error: "room not found" }, { status: 404 });
  return NextResponse.json({ ok: true, session });
}
