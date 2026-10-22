import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";
import {
  base64Bytes,
  getCloudRepo,
  MAX_STATE_BYTES,
  type NewSaveState,
} from "@/lib/cloud-repo";

export const runtime = "nodejs";

/** Cloud save states for one rom (mine only). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const states = await getCloudRepo().listSaveStates(user.id, params.id);
  return NextResponse.json({ ok: true, states });
}

/** Save a state (base64 bytes + optional frame thumbnail) to the account. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<NewSaveState> | null;
  if (!body?.state || typeof body.state !== "string") {
    return NextResponse.json({ ok: false, error: "state (base64) is required" }, { status: 400 });
  }
  if (base64Bytes(body.state) > MAX_STATE_BYTES) {
    return NextResponse.json(
      { ok: false, error: `state exceeds ${MAX_STATE_BYTES} bytes` },
      { status: 413 },
    );
  }

  const state = await getCloudRepo().createSaveState(user.id, {
    romId: params.id,
    slot: typeof body.slot === "number" ? body.slot : 0,
    label: typeof body.label === "string" ? body.label.slice(0, 120) : "",
    core: typeof body.core === "string" ? body.core.slice(0, 32) : "",
    state: body.state,
    thumbnail: typeof body.thumbnail === "string" ? body.thumbnail : null,
  });
  return NextResponse.json({ ok: true, state }, { status: 201 });
}
