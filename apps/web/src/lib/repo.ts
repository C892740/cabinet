/**
 * Repository layer.
 *
 * One interface, two implementations:
 *   • demo — in-memory dataset, so `npm run dev` works with zero setup
 *   • neon — Drizzle ORM against Neon Postgres (see packages/db)
 *
 * The web app never talks to the database driver directly; that keeps the
 * Vercel deployment and the future desktop sync path on the same contract.
 */

import type {
  AchievementSet,
  AdminStats,
  Collection,
  Platform,
  Rom,
  RomRegion,
  User,
  UserRole,
} from "./types";
import { NeonRepo } from "./neon-repo";
import { summaryFor, enrichRom, buildAchievementSet, type RomMetadataPatch } from "./enrich";

export interface RomFilter {
  query?: string;
  platform?: string;
  favoritesOnly?: boolean;
  sort?: "title" | "rating" | "recent" | "played";
}

export interface NewUser {
  email: string;
  displayName: string;
  passwordHash: string;
  role?: UserRole;
}

export interface NewRom {
  title: string;
  platformSlug: string;
  year: number;
  genre: string;
  players?: number;
  rating?: number;
  region?: RomRegion;
  sizeMb?: number;
  description?: string;
  filePath?: string;
}

export interface UserWithSecret extends User {
  passwordHash: string;
}

export interface Repo {
  readonly kind: "demo" | "neon";

  listPlatforms(): Promise<Platform[]>;
  listRoms(filter?: RomFilter): Promise<Rom[]>;
  getRom(id: string): Promise<Rom | null>;
  toggleFavorite(id: string): Promise<Rom | null>;
  listCollections(): Promise<Collection[]>;

  /** Add a rom; cover art + achievements resolve automatically. */
  createRom(input: NewRom): Promise<Rom>;
  /** Full achievement set for a rom (RA data or demo fixtures). */
  getAchievements(romId: string): Promise<AchievementSet | null>;
  /** Persist the results of the metadata pipeline. */
  updateRomMetadata(id: string, patch: Partial<RomMetadataPatch>): Promise<Rom | null>;

  findUserByEmail(email: string): Promise<UserWithSecret | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(input: NewUser): Promise<User>;
  listUsers(): Promise<User[]>;

  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findUserBySessionToken(tokenHash: string): Promise<User | null>;
  deleteSession(tokenHash: string): Promise<void>;

  stats(): Promise<AdminStats>;
}

// The singleton lives on globalThis: Next dev (and any multi-bundle runtime)
// gives each route its own module instance, and a module-level cache would
// split the demo state — and the session store — across routes.
const store = globalThis as typeof globalThis & { __cabinetRepo?: Repo };

export function getRepo(): Repo {
  if (store.__cabinetRepo) return store.__cabinetRepo;
  store.__cabinetRepo = process.env.DATABASE_URL ? createNeonRepo() : createDemoRepo();
  return store.__cabinetRepo;
}

// ─── Demo implementation ────────────────────────────────────────────────────

import {
  collections as demoCollections,
  platforms as demoPlatforms,
  roms as demoRoms,
} from "./demo-data";

function createDemoRepo(): Repo {
  const roms = new Map<string, Rom>(demoRoms.map((r) => [r.id, { ...r }]));
  const users = new Map<string, UserWithSecret>();
  const sessions = new Map<string, string>(); // tokenHash -> userId

  // A ready-made admin account so the demo dashboard is reachable.
  users.set("u_admin", {
    id: "u_admin",
    email: "admin@cabinet.local",
    displayName: "Alex Admin",
    role: "admin",
    avatarHue: 265,
    createdAt: new Date(2026, 0, 1).toISOString(),
    passwordHash: "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA",
  });

  return {
    kind: "demo",

    async listPlatforms() {
      return demoPlatforms.map((p) => ({
        ...p,
        romCount: [...roms.values()].filter((r) => r.platformSlug === p.slug).length,
      }));
    },

    async listRoms(filter = {}) {
      let list = [...roms.values()];
      if (filter.platform) list = list.filter((r) => r.platformSlug === filter.platform);
      if (filter.favoritesOnly) list = list.filter((r) => r.favorite);
      if (filter.query) {
        const q = filter.query.toLowerCase();
        list = list.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.genre.toLowerCase().includes(q) ||
            r.platformSlug.includes(q),
        );
      }
      switch (filter.sort) {
        case "rating":
          list.sort((a, b) => b.rating - a.rating);
          break;
        case "recent":
          list.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
          break;
        case "played":
          list.sort((a, b) => (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? ""));
          break;
      default:
        list.sort((a, b) => a.sortTitle.localeCompare(b.sortTitle));
    }
    return list.map((rom) => ({ ...rom, achievements: summaryFor(rom) }));
  },

    async getRom(id) {
      const rom = roms.get(id);
      return rom ? { ...rom, achievements: summaryFor(rom) } : null;
    },

    async toggleFavorite(id) {
      const rom = roms.get(id);
      if (!rom) return null;
      rom.favorite = !rom.favorite;
      return rom;
    },

    async createRom(input) {
      const sortTitle = input.title.replace(/^(the|a|an) /i, "").toLowerCase();
      const rom: Rom = {
        id: `rom_${Math.random().toString(36).slice(2, 10)}`,
        title: input.title,
        sortTitle,
        platformSlug: input.platformSlug,
        year: input.year,
        genre: input.genre,
        players: input.players ?? 1,
        rating: input.rating ?? 8,
        region: input.region ?? "USA",
        sizeMb: input.sizeMb ?? 1,
        description: input.description ?? "",
        favorite: false,
        playtimeHours: 0,
        lastPlayedAt: null,
        coverSeed: Math.floor(Math.random() * 10000),
        filePath: input.filePath ?? `/${input.platformSlug}/${input.title}.zip`,
        addedAt: new Date().toISOString(),
        coverUrl: null,
        coverProvider: "generated",
        raGameId: null,
      };
      // Cover art + achievements resolve automatically on add.
      const patch = await enrichRom(rom);
      Object.assign(rom, patch);
      roms.set(rom.id, rom);
      return { ...rom, achievements: summaryFor(rom) };
    },

    async getAchievements(id) {
      const rom = roms.get(id);
      return rom ? buildAchievementSet(rom) : null;
    },

    async updateRomMetadata(id, patch) {
      const rom = roms.get(id);
      if (!rom) return null;
      Object.assign(rom, patch);
      return { ...rom, achievements: summaryFor(rom) };
    },

    async listCollections() {
      return demoCollections.map((c) => ({
        ...c,
        romIds: c.romIds.filter((id) => roms.has(id)),
      }));
    },

    async findUserByEmail(email) {
      const lower = email.toLowerCase();
      for (const user of users.values()) {
        if (user.email === lower) return user;
      }
      return null;
    },

    async findUserById(id) {
      const user = users.get(id);
      if (!user) return null;
      // Never hand the password hash to callers of the public User shape.
      const { passwordHash: _pw, ...safe } = user;
      return safe;
    },

    async createUser(input) {
      const user: UserWithSecret = {
        id: `u_${Math.random().toString(36).slice(2, 10)}`,
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        role: input.role ?? "user",
        avatarHue: Math.floor(Math.random() * 360),
        createdAt: new Date().toISOString(),
        passwordHash: input.passwordHash,
      };
      users.set(user.id, user);
      const { passwordHash: _pw, ...safe } = user;
      return safe;
    },

    async listUsers() {
      return [...users.values()].map(({ passwordHash: _pw, ...user }) => user);
    },

    async createSession(_userId, tokenHash, _expiresAt) {
      sessions.set(tokenHash, _userId);
    },

    async findUserBySessionToken(tokenHash) {
      const userId = sessions.get(tokenHash);
      if (!userId) return null;
      const user = users.get(userId);
      if (!user) return null;
      const { passwordHash: _pw, ...rest } = user;
      return rest;
    },

    async deleteSession(tokenHash) {
      sessions.delete(tokenHash);
    },

    async stats() {
      const all = [...roms.values()];
      return {
        totalUsers: users.size,
        totalRoms: all.length,
        totalPlatforms: demoPlatforms.length,
        totalPlaytimeHours: all.reduce((sum, r) => sum + r.playtimeHours, 0),
        storageMb: Math.round(all.reduce((sum, r) => sum + r.sizeMb, 0)),
        recentEvents: [
          { id: "e1", action: "Library scan completed — 3 new games", actorEmail: "admin@cabinet.local", createdAt: new Date(Date.now() - 1000 * 60 * 22).toISOString() },
          { id: "e2", action: "Metadata refreshed from IGDB", actorEmail: "system@cabinet.local", createdAt: new Date(Date.now() - 1000 * 60 * 96).toISOString() },
          { id: "e3", action: "New user registered", actorEmail: "sam@example.com", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
          { id: "e4", action: "Admin dashboard unlocked", actorEmail: "admin@cabinet.local", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString() },
        ],
      };
    },
  };
}

// ─── Neon implementation ────────────────────────────────────────────────────

function createNeonRepo(): Repo {
  return new NeonRepo();
}
