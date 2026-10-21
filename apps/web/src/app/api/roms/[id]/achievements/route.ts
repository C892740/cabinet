import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { enrichRom } from "@/lib/enrich";
import { isSameOriginRequest } from "@/lib/security";

export const runtime = "nodejs";

/**
 * Full achievement set for a rom — the PS5-style trophy screen data.
 * RetroAchievements data when configured, demo fixtures otherwise.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const repo = getRepo();
  const rom = await repo.getRom(params.id);
  if (!rom) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  const set = await repo.getAchievements(params.id);
  return NextResponse.json({ ok: true, achievements: set });
}

/** Re-run the metadata pipeline (cover art + achievement match/sync). */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  if (!isSameOriginRequest(_request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const repo = getRepo();
  const rom = await repo.getRom(params.id);
  if (!rom) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  const patch = await enrichRom(rom);
  const updated = await repo.updateRomMetadata(params.id, patch);
  return NextResponse.json({ ok: true, rom: updated });
}
