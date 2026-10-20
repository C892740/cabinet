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
