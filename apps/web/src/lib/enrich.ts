/**
 * Metadata enrichment — cover art + achievements for a rom.
 *
 * Shared by both repository implementations and the refresh endpoint:
 *
 *   • `buildAchievementSet` — real RetroAchievements data when configured,
 *     otherwise the demo fixture set, otherwise null.
 *   • `summaryFor` — the compact summary embedded in library listings.
 *   • `coverFor` — the automatic cover pipeline result.
 */

import type { AchievementSet, AchievementSource, AchievementSummary, Rom } from "./types";
import { resolveCover } from "./covers";
import { demoAchievementSet } from "./demo-achievements";
import { fetchRaAchievementSet, findRaGameId, raConfigured } from "./ra";

export interface RomMetadataPatch {
  coverUrl: string | null;
  coverProvider: Rom["coverProvider"];
  raGameId: number | null;
  achievementsSummary: AchievementSummary | null;
}

export function summaryFrom(
  set: Omit<AchievementSet, "source" | "fetchedAt">,
  source: AchievementSource,
): AchievementSummary {
  return {
    source,
    raGameId: set.raGameId,
    total: set.total,
    unlocked: set.unlocked,
    pointsEarned: set.pointsEarned,
    pointsTotal: set.pointsTotal,
    completionPct: set.completionPct,
  };
}

/**
 * Build the full achievement set for a rom. With RetroAchievements configured
 * this matches the title (cached console list) and fetches the configured
 * user's progress; without it, the demo fixtures stand in.
 */
export async function buildAchievementSet(rom: Rom): Promise<AchievementSet | null> {
  if (raConfigured()) {
    let raGameId = rom.raGameId;
    if (!raGameId) {
      raGameId = await findRaGameId(rom.title, rom.platformSlug);
    }
    if (raGameId) {
      const set = await fetchRaAchievementSet(raGameId);
      if (set) {
        return {
          ...set,
          source: "retroachievements",
          fetchedAt: new Date().toISOString(),
        };
      }
    }
    return null;
  }
  return demoAchievementSet(rom);
}

/**
 * The summary embedded in listings. Demo fixtures are computed inline; real
 * data comes from the cached column populated when the set was last fetched.
 */
export function summaryFor(rom: Rom): AchievementSummary | null {
  if (rom.achievements) return rom.achievements;
  if (!raConfigured()) {
    const demo = demoAchievementSet(rom);
    return demo ? summaryFrom(demo, "demo") : null;
  }
  return null;
}

/** Run the full metadata pipeline for a rom (used on add and refresh). */
export async function enrichRom(rom: Rom, raBoxArtPath?: string | null): Promise<RomMetadataPatch> {
  const cover = resolveCover(rom, raBoxArtPath);
  let raGameId = rom.raGameId;
  let summary: AchievementSummary | null = summaryFor(rom);

  if (raConfigured()) {
    if (!raGameId) raGameId = await findRaGameId(rom.title, rom.platformSlug);
    if (raGameId) {
      const set = await fetchRaAchievementSet(raGameId);
      if (set) {
        summary = summaryFrom(set, "retroachievements");
        if (set.boxArtUrl) {
          return {
            coverUrl: set.boxArtUrl,
            coverProvider: "retroachievements",
            raGameId,
            achievementsSummary: summary,
          };
        }
      }
    }
  }

  return {
    coverUrl: cover.coverUrl,
    coverProvider: cover.coverProvider,
    raGameId,
    achievementsSummary: summary,
  };
}
