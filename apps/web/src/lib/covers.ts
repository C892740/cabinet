/**
 * Cover art pipeline.
 *
 * When a rom is added, Cabinet resolves real box art automatically and stores
 * the winning URL on the row (see `resolveCover`). The chain is designed to
 * work with zero API keys:
 *
 *   1. RetroAchievements box art — when the rom matched a RA game.
 *   2. Libretro thumbnail packs — public, keyless PNG box art covering the
 *      classic systems (https://thumbnails.libretro.com/).
 *   3. Generated cover art — the deterministic CoverArt component, always
 *      available as the graceful fallback (also the <img> onError target).
 *
 * Libretro names its files like No-Intro ROMs ("Chrono Trigger (USA).png"),
 * so we generate a small list of candidate names and let the client try them
 * in order until one loads.
 */

import type { CoverProvider, Platform, Rom } from "./types";

export interface CoverResolution {
  coverUrl: string | null;
  coverProvider: CoverProvider;
  /** Candidate URLs, best first — the UI fails over across this list. */
  candidates: string[];
}

const RA_IMAGE_HOST = "https://i.retroachievements.org";

/** RetroAchievements box art path → absolute URL. */
export function raImageUrl(sitePath: string | null | undefined): string | null {
  if (!sitePath) return null;
  if (sitePath.startsWith("http")) return sitePath;
  return `${RA_IMAGE_HOST}${sitePath.startsWith("/") ? "" : "/"}${sitePath}`;
}

/**
 * Libretro thumbnail system folders for Cabinet platform slugs.
 * Only systems whose packs use the standard folder naming are listed;
 * anything else falls through to generated art.
 */
const LIBRETRO_FOLDERS: Record<string, string> = {
  nes: "Nintendo - Nintendo Entertainment System",
  snes: "Nintendo - Super Nintendo Entertainment System",
  gb: "Nintendo - Game Boy",
  gba: "Nintendo - Game Boy Advance",
  genesis: "Sega - Mega Drive - Genesis",
  n64: "Nintendo - Nintendo 64",
  psx: "Sony - PlayStation",
  gamegear: "Sega - Game Gear",
};

const REGION_SUFFIXES = ["(USA)", "(World)", "(Europe)", "(Japan)", "(Rev 1)"];

function normalizeTitle(title: string): string {
  return title
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[:'’.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function libretroCandidates(rom: Rom): string[] {
  const folder = LIBRETRO_FOLDERS[rom.platformSlug];
  if (!folder) return [];
  const base = normalizeTitle(rom.title);
  if (!base) return [];
  const names = [base, ...REGION_SUFFIXES.map((suffix) => `${base} ${suffix}`)];
  return names.map(
    (name) =>
      `https://thumbnails.libretro.com/${encodeURIComponent(folder)}/Named_Boxarts/${encodeURIComponent(name)}.png`,
  );
}

/**
 * Resolve cover art for a rom. `raBoxArtPath` is the `ImageBoxArt` field from
 * the RetroAchievements API when a match exists.
 */
export function resolveCover(rom: Rom, raBoxArtPath?: string | null): CoverResolution {
  const ra = raImageUrl(raBoxArtPath);
  if (ra) {
    return { coverUrl: ra, coverProvider: "retroachievements", candidates: [ra] };
  }
  const candidates = libretroCandidates(rom);
  if (candidates.length > 0) {
    return { coverUrl: candidates[0] ?? null, coverProvider: "libretro", candidates };
  }
  return { coverUrl: null, coverProvider: "generated", candidates: [] };
}

/**
 * Candidate list for the browser: stored URL first (if any), then the rest of
 * the chain, ending at the generated-cover fallback (empty list = generated).
 */
export function coverCandidates(rom: Rom): string[] {
  const candidates = [...libretroCandidates(rom)];
  if (rom.coverUrl && !candidates.includes(rom.coverUrl)) {
    candidates.unshift(rom.coverUrl);
  }
  return candidates;
}

/** Short label for the "cover source" chip in the rom modal. */
export function coverProviderLabel(provider: CoverProvider, _platform?: Platform): string {
  switch (provider) {
    case "retroachievements":
      return "RetroAchievements art";
    case "libretro":
      return "Libretro thumbnails";
    default:
      return "Generated artwork";
  }
}
