import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import { getCloudRepo } from "@/lib/cloud-repo";

export const runtime = "nodejs";

/** Close a play session with its measured duration. */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { durationSeconds?: number } | null;
  const duration = Math.max(0, Math.min(24 * 3600, Number(body?.durationSeconds ?? 0)));
  const session = await getCloudRepo().endPlaySession(user.id, params.id, Math.round(duration));
  if (!session) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, session });
}
