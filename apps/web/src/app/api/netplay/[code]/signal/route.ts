import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import { getCloudRepo, type NewNetplayMessage } from "@/lib/cloud-repo";
import type { NetplayRole } from "@/lib/types";

export const runtime = "nodejs";

const KINDS = new Set(["offer", "answer", "ice", "bye", "chat"]);

/**
 * Polling-based WebRTC signalling.
 *
 * POST — append a message (SDP offer/answer, trickled ICE candidate, bye, chat).
 * GET ?after=<seq>&role=host|guest — messages from the *other* role after seq.
 * Peers poll until the data channel is up; gameplay then runs peer-to-peer.
 */
export async function POST(request: Request, { params }: { params: { code: string } }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { fromRole?: string; kind?: string; payload?: unknown }
    | null;
  const fromRole: NetplayRole = body?.fromRole === "guest" ? "guest" : "host";
  const kind = body?.kind ?? "";
  if (!KINDS.has(kind)) {
    return NextResponse.json({ ok: false, error: "invalid kind" }, { status: 400 });
  }

  await getCloudRepo().postNetplayMessage(params.code, {
    fromRole,
    kind: kind as NewNetplayMessage["kind"],
    payload: body?.payload ?? {},
  });
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const after = Number(url.searchParams.get("after") ?? 0) || 0;
  const role: NetplayRole = url.searchParams.get("role") === "guest" ? "guest" : "host";

  const messages = await getCloudRepo().readNetplayMessages(params.code, after, role);
  return NextResponse.json({ ok: true, messages });
}
