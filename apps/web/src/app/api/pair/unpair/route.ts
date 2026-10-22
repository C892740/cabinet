import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getPairRepo } from "@/lib/pair-repo";
import { isSameOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

/** POST — drop a phone ↔ TV link (either side, same account). */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const code = (body?.code ?? "").replace(/[^0-9]/g, "");
  const removed = await getPairRepo().removePair(user.id, code);
  return NextResponse.json({ ok: true, removed });
}
