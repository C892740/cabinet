/**
 * IGDB metadata provider (via Twitch app access tokens).
 *
 * Server-side only — the Twitch client secret never reaches the browser.
 * Auth: client-credentials grant against id.twitch.tv, cached until expiry.
 * Queries: POST APICalypse text to api.igdb.com/v4 (4 req/s limit — Cabinet
 * keeps scans serial and small).
 */

export interface IgdbGame {
  id: number;
  name: string;
  coverUrl: string | null;
  year: number | null;
  description: string | null;
  genres: string[];
  platforms: string[];
  playersGuess: number | null;
}

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_API = "https://api.igdb.com/v4";

export function igdbConfigured(): boolean {
  return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET);
}

let tokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string | null> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  if (!igdbConfigured()) return null;
  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID!,
        client_secret: process.env.TWITCH_CLIENT_SECRET!,
        grant_type: "client_credentials",
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access_token: string; expires_in: number };
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + Math.max(60, data.expires_in - 120) * 1000,
    };
    return tokenCache.token;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function igdbQuery(endpoint: string, query: string): Promise<unknown[] | null> {
  const token = await accessToken();
  if (!token) return null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${IGDB_API}/${endpoint}`, {
        method: "POST",
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID!,
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: query,
        cache: "no-store",
      });
      // IGDB allows 4 req/s — one slow retry absorbs a burst-limit 429.
      if (response.status === 429 && attempt === 0) {
        await sleep(400);
        continue;
      }
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Build a cover URL of the requested size from an IGDB image id. */
export function igdbCoverUrl(imageId: string, size = "t_cover_big"): string {
  return `https://images.igdb.com/igdb/image/upload/${size}/${imageId}.jpg`;
}

type IgdbGameRaw = {
  id: number;
  name: string;
  summary?: string;
  cover?: { image_id?: string };
  first_release_date?: number;
  genres?: { name?: string }[];
  platforms?: { name?: string }[];
};

function toIgdbGame(raw: IgdbGameRaw): IgdbGame {
  return {
    id: raw.id,
    name: raw.name,
    coverUrl: raw.cover?.image_id ? igdbCoverUrl(raw.cover.image_id) : null,
    year: raw.first_release_date
      ? new Date(raw.first_release_date * 1000).getUTCFullYear()
      : null,
    description: raw.summary ?? null,
    genres: (raw.genres ?? []).map((g) => g.name ?? "").filter(Boolean),
    platforms: (raw.platforms ?? []).map((p) => p.name ?? "").filter(Boolean),
    playersGuess: null,
  };
}

/**
 * Search IGDB for a game by (cleaned) title, preferring results whose
 * platforms mention the target platform name.
 */
export async function igdbSearchGame(
  title: string,
  platformName?: string,
): Promise<IgdbGame | null> {
  const escaped = title.replace(/"/g, '\\"').slice(0, 100);
  const rows = await igdbQuery(
    "games",
    `search "${escaped}"; fields name,cover.image_id,summary,first_release_date,genres.name,platforms.name; limit 5;`,
  );
  if (!rows || rows.length === 0) return null;
  const games = rows as IgdbGameRaw[];
  let chosen = games[0];
  if (platformName) {
    const needle = platformName.toLowerCase();
    const exact = games.find((g) =>
      (g.platforms ?? []).some((p) => (p.name ?? "").toLowerCase().includes(needle)),
    );
    if (exact) chosen = exact;
  }
  return toIgdbGame(chosen);
}
