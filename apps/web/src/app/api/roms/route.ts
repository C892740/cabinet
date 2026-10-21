import { NextResponse } from "next/server";
import { getRepo, type RomFilter, type NewRom } from "@/lib/repo";
import { isSameOriginRequest } from "@/lib/security";
import type { RomRegion } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filter: RomFilter = {
    query: url.searchParams.get("q") ?? undefined,
    platform: url.searchParams.get("platform") ?? undefined,
    favoritesOnly: url.searchParams.get("favorites") === "true",
    sort: (url.searchParams.get("sort") as RomFilter["sort"]) ?? "title",
  };

  const repo = getRepo();
  const [roms, platforms] = await Promise.all([repo.listRoms(filter), repo.listPlatforms()]);
  return NextResponse.json({ ok: true, roms, platforms, storage: repo.kind });
}

/**
 * Add a rom. Cover art and RetroAchievements matching run automatically —
 * the response already carries the resolved cover and achievement summary.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Partial<NewRom> | null;
  if (!body?.title?.trim() || !body.platformSlug || !body.year || !body.genre?.trim()) {
    return NextResponse.json(
      { ok: false, error: "title, platformSlug, year and genre are required" },
      { status: 400 },
    );
  }

  const repo = getRepo();
  const rom = await repo.createRom({
    title: body.title.trim(),
    platformSlug: body.platformSlug,
    year: Number(body.year),
    genre: body.genre.trim(),
    players: body.players ? Number(body.players) : undefined,
    rating: body.rating ? Number(body.rating) : undefined,
    region: body.region as RomRegion | undefined,
    sizeMb: body.sizeMb ? Number(body.sizeMb) : undefined,
    description: body.description?.trim(),
    filePath: body.filePath,
  });
  return NextResponse.json({ ok: true, rom }, { status: 201 });
}
