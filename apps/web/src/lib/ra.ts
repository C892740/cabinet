/**
 * RetroAchievements Web API client (server-side only).
 *
 * Docs: https://api-docs.retroachievements.org — every call goes to
 * retroachievements.org/API/API_*.php and requires the `y` Web API key, which
 * must never reach browser code. Configure with:
 *
 *   RETROACHIEVEMENTS_API_KEY   — Web API key from your RA control panel
 *   RETROACHIEVEMENTS_USERNAME  — the RA username whose unlocks to show
 *
 * RA asks clients to cache aggressively (their game lists are huge and change
 * slowly), so responses go through a write-through cache: in-memory per
 * instance, persisted in the `ra_cache` table when a database is configured.
 */

import type { Achievement, AchievementSet, AchievementTier } from "./types";

const RA_API = "https://retroachievements.org/API";
const GAME_LIST_TTL_MS = 1000 * 60 * 60 * 24; // console game lists: 24h
const PROGRESS_TTL_MS = 1000 * 60 * 5; // user progress: 5 min

export function raConfigured(): boolean {
  return Boolean(
    process.env.RETROACHIEVEMENTS_API_KEY?.trim() &&
      process.env.RETROACHIEVEMENTS_USERNAME?.trim(),
  );
}

// ─── caching ───────────────────────────────────────────────────────────────

type CacheEntry = { value: unknown; expiresAt: number };
const memoryCache = new Map<string, CacheEntry>();

async function cacheGet<T>(key: string): Promise<T | null> {
  const hit = memoryCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  memoryCache.delete(key);
  if (!process.env.DATABASE_URL) return null;
  try {
    const { createDb, raCache } = await import("@cabinet/db");
    const { eq } = await import("drizzle-orm");
    const db = createDb();
    const [row] = await db.select().from(raCache).where(eq(raCache.key, key)).limit(1);
    if (!row) return null;
    const age = Date.now() - row.fetchedAt.getTime();
    if (age > GAME_LIST_TTL_MS) return null;
    memoryCache.set(key, { value: row.payload, expiresAt: row.fetchedAt.getTime() + GAME_LIST_TTL_MS });
    return row.payload as T;
  } catch {
    return null;
  }
}

async function cacheSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (!process.env.DATABASE_URL) return;
  try {
    const { createDb, raCache } = await import("@cabinet/db");
    const db = createDb();
    await db
      .insert(raCache)
      .values({ key, payload: value as never })
      .onConflictDoUpdate({ target: raCache.key, set: { payload: value as never, fetchedAt: new Date() } });
  } catch {
    // cache writes are best-effort
  }
}

// ─── transport ─────────────────────────────────────────────────────────────

async function raGet<T>(endpoint: string, params: Record<string, string | number>): Promise<T | null> {
  const key = process.env.RETROACHIEVEMENTS_API_KEY?.trim();
  if (!key) return null;
  const url = new URL(`${RA_API}/${endpoint}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
  url.searchParams.set("y", key);
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── console mapping ───────────────────────────────────────────────────────

/** Cabinet platform slug → RetroAchievements ConsoleID. */
export const RA_CONSOLE_IDS: Record<string, number> = {
  nes: 7,
  snes: 3,
  gb: 4,
  genesis: 1,
  n64: 2,
  gba: 5,
  psx: 12,
  gamegear: 15,
  dreamcast: 40,
  arcade: 27,
};

// ─── title matching ────────────────────────────────────────────────────────

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(the|a|an|version|rev)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RaListGame {
  ID: number;
  Title: string;
}

/**
 * Find the RA game id for a rom by title within its console's game list.
 * RA has no title-search endpoint, so we fetch the console list (cached 24h)
 * and match locally — exactly what the API docs recommend.
 */
export async function findRaGameId(title: string, platformSlug: string): Promise<number | null> {
  const consoleId = RA_CONSOLE_IDS[platformSlug];
  if (!consoleId) return null;

  const cacheKey = `gamelist:${consoleId}`;
  let list = await cacheGet<RaListGame[]>(cacheKey);
  if (!list) {
    const fetched = await raGet<RaListGame[]>("API_GetGameList.php", { i: consoleId, f: 1 });
    if (!Array.isArray(fetched)) return null;
    list = fetched;
    await cacheSet(cacheKey, list, GAME_LIST_TTL_MS);
  }

  const target = normalizeTitle(title);
  if (!target) return null;

  let best: { id: number; score: number } | null = null;
  for (const game of list) {
    const candidate = normalizeTitle(game.Title);
    if (!candidate) continue;
    let score = 0;
    if (candidate === target) score = 3;
    else if (candidate.startsWith(target) || target.startsWith(candidate)) score = 2;
    else if (candidate.includes(target) || target.includes(candidate)) score = 1;
    if (score > 0 && (!best || score > best.score)) best = { id: game.ID, score };
    if (score === 3) break;
  }
  return best?.id ?? null;
}

// ─── achievement sets ──────────────────────────────────────────────────────

export function tierForPoints(points: number): AchievementTier {
  if (points >= 25) return "gold";
  if (points >= 10) return "silver";
  return "bronze";
}

interface RaAchievementRaw {
  ID: number;
  Title: string;
  Description: string;
  Points: number;
  BadgeName: string;
  TrueRatio?: number;
  DateEarned?: string | null;
  DateEarnedHardcore?: string | null;
}

interface RaUserProgressRaw {
  ID: number;
  Title: string;
  ConsoleID: number;
  ConsoleName: string;
  ImageIcon?: string;
  ImageBoxArt?: string;
  NumAchievements: number;
  NumAwardedToUser?: number;
  NumAwardedToUserHardcore?: number;
  UserCompletion?: string;
  Achievements?: Record<string, RaAchievementRaw>;
}

function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // RA returns "2016-03-12 17:47:29" (UTC) — make it ISO.
  const iso = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Full achievement set for a game including the configured user's unlocks —
 * one call to API_GetGameInfoAndUserProgress covers both.
 */
export async function fetchRaAchievementSet(
  raGameId: number,
): Promise<Omit<AchievementSet, "source" | "fetchedAt"> | null> {
  const username = process.env.RETROACHIEVEMENTS_USERNAME?.trim();
  if (!username) return null;

  const cacheKey = `progress:${raGameId}:${username.toLowerCase()}`;
  const cached = await cacheGet<Omit<AchievementSet, "source" | "fetchedAt">>(cacheKey);
  if (cached) return cached;

  const raw = await raGet<RaUserProgressRaw>("API_GetGameInfoAndUserProgress.php", {
    g: raGameId,
    u: username,
  });
  if (!raw || !raw.Achievements) return null;

  const achievements: Achievement[] = Object.values(raw.Achievements)
    .sort((a, b) => a.ID - b.ID)
    .map((a) => {
      const unlockedAt = normalizeDate(a.DateEarned);
      return {
        id: String(a.ID),
        title: a.Title,
        description: a.Description,
        points: a.Points,
        tier: tierForPoints(a.Points),
        badgeUrl: a.BadgeName ? `https://i.retroachievements.org/Badge/${a.BadgeName}.png` : "",
        unlocked: Boolean(unlockedAt),
        unlockedAt,
        hardcore: Boolean(a.DateEarnedHardcore),
        rarityPct: null,
        secret: false, // computed per-request from the spoiler setting
      };
    });

  const unlocked = achievements.filter((a) => a.unlocked).length;
  const pointsEarned = achievements.filter((a) => a.unlocked).reduce((sum, a) => sum + a.points, 0);
  const pointsTotal = achievements.reduce((sum, a) => sum + a.points, 0);

  const result = {
    raGameId,
    gameTitle: raw.Title,
    consoleName: raw.ConsoleName,
    boxArtUrl: raw.ImageBoxArt ? `https://i.retroachievements.org${raw.ImageBoxArt}` : null,
    total: achievements.length,
    unlocked,
    hardcoreUnlocked: achievements.filter((a) => a.hardcore).length,
    pointsEarned,
    pointsTotal,
    completionPct: achievements.length ? Math.round((unlocked / achievements.length) * 100) : 0,
    achievements,
  };

  await cacheSet(cacheKey, result, PROGRESS_TTL_MS);
  return result;
}
