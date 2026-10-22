/**
 * ScreenScraper (screenscraper.fr) metadata provider — API2.
 *
 * Server-side only: the dev password and member credentials travel as query
 * parameters, so URLs must never be logged. Cabinet identifies ROMs by hash
 * (CRC32/SHA1) + filename + system id via jeuInfos.php, and falls back to the
 * ranked name search (jeuRecherche.php). System ids are discovered at runtime
 * from systemesListe.php and cached — never hard-coded.
 */

const SS_API = "https://api.screenscraper.fr/api2";

export interface SsGame {
  id: string;
  name: string;
  releaseYear: number | null;
  description: string | null;
  genres: string[];
  players: string | null;
  boxUrl: string | null;
  screenshotUrls: string[];
}

export function screenscraperConfigured(): boolean {
  return Boolean(process.env.SCREENSCRAPER_DEV_ID && process.env.SCREENSCRAPER_DEV_PASSWORD);
}

function baseParams(): Record<string, string> {
  const params: Record<string, string> = {
    devid: process.env.SCREENSCRAPER_DEV_ID ?? "",
    devpassword: process.env.SCREENSCRAPER_DEV_PASSWORD ?? "",
    softname: "Cabinet",
    output: "json",
  };
  // Member credentials are optional but raise the daily quota when present.
  if (process.env.SCREENSCRAPER_USER && process.env.SCREENSCRAPER_PASSWORD) {
    params.ssid = process.env.SCREENSCRAPER_USER;
    params.sspassword = process.env.SCREENSCRAPER_PASSWORD;
  }
  return params;
}

/** One GET against API2. Returns parsed JSON or null — never throws, never logs the URL. */
async function ssGet(path: string, params: Record<string, string>): Promise<any | null> {
  if (!screenscraperConfigured()) return null;
  const url = new URL(`${SS_API}/${path}`);
  const merged = { ...baseParams(), ...params };
  for (const [key, value] of Object.entries(merged)) {
    if (value) url.searchParams.set(key, value);
  }
  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ─── system ids (discovered, cached) ────────────────────────────────────────

interface SsSystem {
  id: string;
  names: string[];
}

let systemsCache: { systems: SsSystem[]; fetchedAt: number } | null = null;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function systemList(): Promise<SsSystem[]> {
  if (systemsCache && Date.now() - systemsCache.fetchedAt < 24 * 60 * 60 * 1000) {
    return systemsCache.systems;
  }
  const data = await ssGet("systemesListe.php", {});
  const raw = data?.systemes ?? data?.systeme ?? [];
  const systems: SsSystem[] = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const names: string[] = [];
    const noms = entry?.noms;
    if (Array.isArray(noms)) {
      for (const nom of noms) {
        const text = typeof nom === "string" ? nom : (nom?.text ?? nom?.nom ?? "");
        if (text) names.push(text);
      }
    } else if (noms && typeof noms === "object") {
      names.push(...Object.values(noms).filter((v): v is string => typeof v === "string"));
    }
    if (entry?.id && names.length) systems.push({ id: String(entry.id), names });
  }
  if (systems.length) systemsCache = { systems, fetchedAt: Date.now() };
  return systems;
}

/** Map a Cabinet platform to a ScreenScraper system id by name matching. */
export async function ssSystemId(platform: {
  slug: string;
  name: string;
  shortName: string;
}): Promise<string | null> {
  const systems = await systemList();
  const candidates = [platform.shortName, platform.name, platform.slug].map(normalize);
  for (const system of systems) {
    for (const name of system.names) {
      const normalized = normalize(name);
      if (candidates.some((c) => c && (normalized === c || normalized.includes(c)))) {
        return system.id;
      }
    }
  }
  return null;
}

// ─── game identification ────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

function pickText(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = pickText(item);
      if (text) return text;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const key of ["text", "nom_en", "en", "nom", "description"]) {
      if (typeof value[key] === "string") return value[key];
    }
    for (const nested of Object.values(value)) {
      const text = pickText(nested);
      if (text) return text;
    }
  }
  return null;
}

function parseGame(jeu: any): SsGame | null {
  if (!jeu) return null;
  const name = pickText(jeu.noms) ?? null;
  const genres: string[] = [];
  for (const genre of jeu.genres ?? []) {
    const text = pickText(genre);
    if (text) genres.push(text);
  }
  const screenshotUrls: string[] = [];
  let boxUrl: string | null = null;
  for (const media of jeu.medias ?? []) {
    const type = String(media?.type ?? "");
    const url = String(media?.url ?? "");
    if (!url) continue;
    if (type === "box-2D" && !boxUrl) boxUrl = url;
    if (type === "ss" || type === "sstitle") screenshotUrls.push(url);
  }
  const yearText = pickText(jeu.dates) ?? "";
  const yearMatch = yearText.match(/(\d{4})/);
  return {
    id: String(jeu.id ?? jeu.jeuid ?? ""),
    name: name ?? "Unknown",
    releaseYear: yearMatch ? Number(yearMatch[1]) : null,
    description: pickText(jeu.synopsis) ?? null,
    genres: genres.slice(0, 3),
    players: pickText(jeu.joueurs),
    boxUrl,
    screenshotUrls: screenshotUrls.slice(0, 3),
  };
}

/** Identify a ROM by hash + filename (the accurate path). */
export async function ssIdentifyRom(
  file: { fileName: string; sizeBytes: number; crc32?: string; sha1?: string },
  systemId: string,
): Promise<SsGame | null> {
  const params: Record<string, string> = {
    systemeid: systemId,
    romtype: "rom",
    romnom: file.fileName,
    romtaille: String(file.sizeBytes),
  };
  if (file.crc32) params.crc = file.crc32.toUpperCase();
  if (file.sha1) params.sha1 = file.sha1.toUpperCase();
  const data = await ssGet("jeuInfos.php", params);
  return parseGame(data?.jeu ?? data);
}

/** Ranked name search fallback (up to 30 candidates; we take the best). */
export async function ssSearchName(name: string, systemId: string): Promise<SsGame | null> {
  const data = await ssGet("jeuRecherche.php", { recherche: name, systemeid: systemId });
  const results = data?.response?.jeux ?? data?.jeux ?? [];
  const list = Array.isArray(results) ? results : [];
  if (!list.length) return null;
  const first = list[0];
  const jeu = first?.jeu ?? first;
  const parsed = parseGame(jeu);
  if (parsed) return parsed;
  // Some responses only carry ids — fetch the full record.
  const id = jeu?.id ?? jeu?.jeuid;
  if (!id) return null;
  const full = await ssGet("jeuInfos.php", { systemeid: systemId, jeuid: String(id) });
  return parseGame(full?.jeu ?? full);
}
