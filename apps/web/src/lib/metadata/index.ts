/**
 * Server-side ROM scanning pipeline.
 *
 * The scanner (desktop app or the web scan panel) hashes files locally and
 * posts the manifests here; all third-party lookups happen on the server so
 * API credentials stay secret. Matching order per file:
 *
 *   1. ScreenScraper jeuInfos by CRC32/SHA1 + filename + system id (hash match)
 *   2. ScreenScraper ranked name search (name match)
 *   3. IGDB title search, platform-aware (name match)
 *   4. Nothing configured → the file is returned unmatched (import still works)
 */

import type { MetadataMatch, ProvidersStatus, ScannedRomFile } from "../types";
import { igdbConfigured, igdbSearchGame } from "./igdb";
import {
  screenscraperConfigured,
  ssIdentifyRom,
  ssSearchName,
  ssSystemId,
} from "./screenscraper";

export function providersStatus(): ProvidersStatus {
  return { igdb: igdbConfigured(), screenscraper: screenscraperConfigured() };
}

/** Strip no-intro/TOSEC naming noise: extensions, region tags, flags, underscores. */
export function cleanRomTitle(fileName: string): string {
  return fileName
    .replace(/\.(zip|7z|rar|nes|sfc|smc|gb|gbc|gba|gen|md|bin|cue|iso|chd|n64|z64|v64|gg|sms|nds|pce)$/i, "")
    .replace(/\[.*?\]/g, " ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[_+.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PLATFORM_NAMES: Record<string, string> = {
  nes: "Nintendo Entertainment System",
  snes: "Super Nintendo",
  gb: "Game Boy",
  gba: "Game Boy Advance",
  genesis: "Mega Drive / Genesis",
  n64: "Nintendo 64",
  psx: "PlayStation",
  dreamcast: "Dreamcast",
  gamegear: "Game Gear",
  arcade: "Arcade",
};

async function matchOne(file: ScannedRomFile): Promise<MetadataMatch> {
  const base: MetadataMatch = {
    fileName: file.fileName,
    provider: "none",
    matchMethod: "none",
    externalId: null,
    title: cleanRomTitle(file.fileName) || file.fileName,
    description: null,
    year: null,
    genre: null,
    players: null,
    coverUrl: null,
    screenshotUrls: [],
  };

  if (screenscraperConfigured()) {
    const systemId = await ssSystemId({
      slug: file.platformSlug,
      name: PLATFORM_NAMES[file.platformSlug] ?? file.platformSlug,
      shortName: file.platformSlug,
    });
    if (systemId) {
      const hashed = (file.crc32 || file.sha1)
        ? await ssIdentifyRom(file, systemId)
        : null;
      const byName = hashed ?? (await ssSearchName(base.title ?? file.fileName, systemId));
      if (byName) {
        return {
          ...base,
          provider: "screenscraper",
          matchMethod: hashed ? "hash" : "name",
          externalId: byName.id || null,
          title: byName.name || base.title,
          description: byName.description,
          year: byName.releaseYear,
          genre: byName.genres[0] ?? null,
          players: byName.players ? Number(byName.players.replace(/\D+/g, "")) || null : null,
          coverUrl: byName.boxUrl,
          screenshotUrls: byName.screenshotUrls,
        };
      }
    }
  }

  if (igdbConfigured()) {
    const game = await igdbSearchGame(
      base.title ?? file.fileName,
      PLATFORM_NAMES[file.platformSlug] ?? file.platformSlug,
    );
    if (game) {
      return {
        ...base,
        provider: "igdb",
        matchMethod: "name",
        externalId: String(game.id),
        title: game.name || base.title,
        description: game.description,
        year: game.year,
        genre: game.genres[0] ?? null,
        players: null,
        coverUrl: game.coverUrl,
        screenshotUrls: [],
      };
    }
  }

  return base;
}

/** Scan a manifest of hashed ROM files. Capped so one request can't burn a quota. */
export async function scanFiles(files: ScannedRomFile[]): Promise<{
  matches: MetadataMatch[];
  providers: ProvidersStatus;
}> {
  const limited = files.slice(0, 40);
  const matches: MetadataMatch[] = [];
  for (const file of limited) {
    matches.push(await matchOne(file));
  }
  return { matches, providers: providersStatus() };
}
