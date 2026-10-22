/**
 * Shared domain model for Cabinet.
 *
 * These types are the contract between the web app (Next.js), the desktop app
 * (Electron) and the API layer. Keep them serialisable — they cross process
 * and network boundaries.
 */

export type UserRole = "user" | "admin";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  avatarHue: number;
  createdAt: string;
}

export interface Platform {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  manufacturer: string;
  releaseYear: number;
  /** Two hex colours used to generate cover art + platform accents. */
  colorA: string;
  colorB: string;
  romCount?: number;
}

export type RomRegion = "USA" | "Europe" | "Japan" | "World" | "Beta";

/** Where a rom's cover image came from. */
export type CoverProvider =
  | "retroachievements"
  | "libretro"
  | "igdb"
  | "screenscraper"
  | "generated";

/** Source of achievement data. */
export type AchievementSource = "retroachievements" | "demo";

/** Trophy-style tier derived from the achievement's point value. */
export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  points: number;
  tier: AchievementTier;
  /** Absolute URL of the badge artwork. */
  badgeUrl: string;
  unlocked: boolean;
  unlockedAt: string | null;
  /** Earned in hardcore mode (no save states). */
  hardcore: boolean;
  /** Percentage of tracked players who earned this (lower = rarer). */
  rarityPct: number | null;
  /**
   * Hidden until the player reveals it — the PS5 "Hidden Trophy" treatment.
   * RetroAchievements has no native secret flag, so Cabinet derives it from
   * the per-user spoiler setting: locked achievements render as secret when
   * spoilers are off.
   */
  secret: boolean;
}

/** Compact progress summary embedded in library listings. */
export interface AchievementSummary {
  source: AchievementSource;
  raGameId: number | null;
  total: number;
  unlocked: number;
  pointsEarned: number;
  pointsTotal: number;
  completionPct: number;
}

/** Full achievement set for one rom (the PS5 trophy screen). */
export interface AchievementSet {
  source: AchievementSource;
  raGameId: number | null;
  gameTitle: string;
  consoleName: string;
  boxArtUrl: string | null;
  total: number;
  unlocked: number;
  hardcoreUnlocked: number;
  pointsEarned: number;
  pointsTotal: number;
  completionPct: number;
  achievements: Achievement[];
  fetchedAt: string;
}

export interface Rom {
  id: string;
  title: string;
  /** Sort key for titles, e.g. "zelda, the legend of". */
  sortTitle: string;
  platformSlug: string;
  year: number;
  genre: string;
  players: number;
  /** 0 – 10 scale. */
  rating: number;
  region: RomRegion;
  sizeMb: number;
  description: string;
  favorite: boolean;
  /** Total hours played across sessions. */
  playtimeHours: number;
  lastPlayedAt: string | null;
  /** Deterministic seed used by the generated cover art. */
  coverSeed: number;
  /** Relative path of the ROM inside the user's library folder. */
  filePath: string;
  addedAt: string;
  /** Resolved cover artwork URL, or null to use the generated cover. */
  coverUrl: string | null;
  coverProvider: CoverProvider;
  /** RetroAchievements game id when the title has been matched. */
  raGameId: number | null;
  /** Achievement progress summary when available. */
  achievements?: AchievementSummary | null;
}

// ─── Emulation: cores, save states, screenshots, history, profiles ─────────

/** EmulatorJS core identifiers supported in the in-browser player. */
export type EmulatorCoreId =
  | "nes"
  | "snes"
  | "gb"
  | "gba"
  | "n64"
  | "segaMD"
  | "segaGG"
  | "segaMS"
  | "psx"
  | "segaSaturn"
  | "atari2600"
  | "nds";

/** How a play session ran. */
export type PlaySource = "browser" | "desktop" | "tv";

export interface SaveState {
  id: string;
  romId: string;
  slot: number;
  label: string;
  core: string;
  sizeBytes: number;
  /** Base64 PNG thumbnail of the frame, when captured. */
  thumbnail: string | null;
  /** Base64 emulator state bytes (the load payload). */
  state: string;
  createdAt: string;
  updatedAt: string;
}

export interface Screenshot {
  id: string;
  romId: string;
  caption: string;
  /** Base64 PNG image data. */
  imageData: string;
  createdAt: string;
}

export interface PlaySession {
  id: string;
  romId: string;
  source: PlaySource;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
}

/** A desktop emulator launch profile (one-click launch). */
export interface EmulatorProfile {
  id: string;
  name: string;
  /** Platform slug, or null for a catch-all profile. */
  platformSlug: string | null;
  emulatorPath: string;
  corePath: string;
  /** Argument template with {rom} {core} {emulator} {title} placeholders. */
  argsTemplate: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Netplay ───────────────────────────────────────────────────────────────

export type NetplayRole = "host" | "guest";
export type NetplayStatus = "lobby" | "live" | "closed";

export interface NetplaySessionInfo {
  code: string;
  hostName: string;
  gameTitle: string;
  core: string;
  romId: string | null;
  status: NetplayStatus;
  createdAt: string;
  expiresAt: string;
}

export interface NetplaySignal {
  seq: number;
  fromRole: NetplayRole;
  kind: "offer" | "answer" | "ice" | "bye" | "chat";
  payload: unknown;
  createdAt: string;
}

// ─── Metadata providers (IGDB, ScreenScraper) + ROM scanning ──────────────

export type MetadataProvider = "igdb" | "screenscraper" | "none";
export type MatchMethod = "hash" | "name" | "none";

/** Which metadata providers are configured (booleans only). */
export interface ProvidersStatus {
  igdb: boolean;
  screenscraper: boolean;
}

/** One file discovered by a library scan (hashes computed by the scanner). */
export interface ScannedRomFile {
  fileName: string;
  sizeBytes: number;
  platformSlug: string;
  crc32?: string;
  sha1?: string;
}

/** A metadata match returned by the server-side scan. */
export interface MetadataMatch {
  fileName: string;
  provider: MetadataProvider;
  matchMethod: MatchMethod;
  externalId: string | null;
  title: string | null;
  description: string | null;
  year: number | null;
  genre: string | null;
  players: number | null;
  coverUrl: string | null;
  screenshotUrls: string[];
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  ownerId: string;
  romIds: string[];
}

export interface AdminStats {
  totalUsers: number;
  totalRoms: number;
  totalPlatforms: number;
  totalPlaytimeHours: number;
  storageMb: number;
  recentEvents: AdminEvent[];
}

export interface AdminEvent {
  id: string;
  action: string;
  actorEmail: string;
  createdAt: string;
}
