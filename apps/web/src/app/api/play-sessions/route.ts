import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import { getCloudRepo, type NewPlaySession } from "@/lib/cloud-repo";
import type { PlaySource } from "@/lib/types";

export const runtime = "nodejs";

/** Play history — all sessions, or ?romId= for one game. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const romId = url.searchParams.get("romId") ?? undefined;
  const sessions = await getCloudRepo().listPlaySessions(user.id, romId);
  return NextResponse.json({ ok: true, sessions });
}

/** Start a play session; PATCH /api/sessions/[id] closes it. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<NewPlaySession> | null;
  if (!body?.romId) {
    return NextResponse.json({ ok: false, error: "romId is required" }, { status: 400 });
  }
  const source: PlaySource =
    body.source === "desktop" || body.source === "tv" ? body.source : "browser";
  const session = await getCloudRepo().startPlaySession(user.id, {
    romId: body.romId,
    source,
    startedAt: typeof body.startedAt === "string" ? body.startedAt : undefined,
  });
  return NextResponse.json({ ok: true, session }, { status: 201 });
}
