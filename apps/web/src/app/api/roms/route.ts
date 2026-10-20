import { NextResponse } from "next/server";
import { getRepo, type RomFilter } from "@/lib/repo";

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
