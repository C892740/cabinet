import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import { getCloudRepo } from "@/lib/cloud-repo";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const removed = await getCloudRepo().deleteSaveState(user.id, params.id);
  return removed
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
}
