import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { isSameOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const rom = await getRepo().getRom(params.id);
  if (!rom) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, rom });
}

/** Patch a rom's metadata (cover URL from a scan match, favorite flag…). */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });

  const repo = getRepo();
  if (typeof body.favorite === "boolean") {
    await repo.toggleFavorite(params.id);
  }
  const patch: Record<string, unknown> = {};
  if (typeof body.coverUrl === "string" || body.coverUrl === null) patch.coverUrl = body.coverUrl;
  if (typeof body.coverProvider === "string") patch.coverProvider = body.coverProvider;
  if (typeof body.raGameId === "number" || body.raGameId === null) patch.raGameId = body.raGameId;

  const rom = Object.keys(patch).length
    ? await repo.updateRomMetadata(params.id, patch)
    : await repo.getRom(params.id);
  if (!rom) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, rom });
}
