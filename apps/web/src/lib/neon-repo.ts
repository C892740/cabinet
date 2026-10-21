/**
 * Neon Postgres implementation of the repository contract.
 *
 * Uses the Drizzle schema in @cabinet/db with Neon's HTTP serverless driver —
 * the combination Vercel recommends for short-lived serverless functions.
 */

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import {
  adminEvents,
  collections,
  createDb,
  platforms,
  roms,
  sessions,
  users,
  type CabinetDb,
} from "@cabinet/db";
import type {
  AchievementSet,
  AchievementSummary,
  AdminStats,
  Collection,
  CoverProvider,
  Platform,
  Rom,
  User,
} from "./types";
import type { NewRom, NewUser, Repo, RomFilter, UserWithSecret } from "./repo";
import { buildAchievementSet, enrichRom, summaryFor, type RomMetadataPatch } from "./enrich";

export class NeonRepo implements Repo {
  readonly kind = "neon" as const;
  private db: CabinetDb;

  constructor(connectionString?: string) {
    this.db = createDb(connectionString);
  }

  async listPlatforms(): Promise<Platform[]> {
    const rows = await this.db
      .select({
        id: platforms.id,
        slug: platforms.slug,
        name: platforms.name,
        shortName: platforms.shortName,
        manufacturer: platforms.manufacturer,
        releaseYear: platforms.releaseYear,
        colorA: platforms.colorA,
        colorB: platforms.colorB,
        romCount: sql<number>`count(${roms.id})::int`,
      })
      .from(platforms)
      .leftJoin(roms, eq(roms.platformSlug, platforms.slug))
      .groupBy(platforms.id);
    return rows;
  }

  async listRoms(filter: RomFilter = {}): Promise<Rom[]> {
    const conditions = [];
    if (filter.platform) conditions.push(eq(roms.platformSlug, filter.platform));
    if (filter.favoritesOnly) conditions.push(eq(roms.favorite, true));
    if (filter.query) {
      const pattern = `%${filter.query}%`;
      conditions.push(
        or(ilike(roms.title, pattern), ilike(roms.genre, pattern))!,
      );
    }

    const order =
      filter.sort === "rating"
        ? desc(roms.rating)
        : filter.sort === "recent"
          ? desc(roms.addedAt)
          : filter.sort === "played"
            ? desc(roms.lastPlayedAt)
            : roms.sortTitle;

    const rows = await this.db
      .select()
      .from(roms)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(order);
    return rows.map(toRom);
  }

  async getRom(id: string): Promise<Rom | null> {
    const [row] = await this.db.select().from(roms).where(eq(roms.id, id)).limit(1);
    return row ? toRom(row) : null;
  }

  async toggleFavorite(id: string): Promise<Rom | null> {
    const [row] = await this.db
      .update(roms)
      .set({ favorite: sql`not ${roms.favorite}` })
      .where(eq(roms.id, id))
      .returning();
    return row ? toRom(row) : null;
  }

  async createRom(input: NewRom): Promise<Rom> {
    const sortTitle = input.title.replace(/^(the|a|an) /i, "").toLowerCase();
    const [row] = await this.db
      .insert(roms)
      .values({
        title: input.title,
        sortTitle,
        platformSlug: input.platformSlug,
        year: input.year,
        genre: input.genre,
        players: input.players ?? 1,
        rating: String(input.rating ?? 8),
        region: input.region ?? "USA",
        sizeMb: String(input.sizeMb ?? 1),
        description: input.description ?? "",
        filePath: input.filePath ?? `/${input.platformSlug}/${input.title}.zip`,
        coverSeed: Math.floor(Math.random() * 10000),
      })
      .returning();
    const rom = toRom(row!);
    // Cover art + achievements resolve automatically on add.
    const patch = await enrichRom(rom);
    return (await this.updateRomMetadata(rom.id, patch)) ?? rom;
  }

  async getAchievements(id: string): Promise<AchievementSet | null> {
    const rom = await this.getRom(id);
    return rom ? buildAchievementSet(rom) : null;
  }

  async updateRomMetadata(id: string, patch: Partial<RomMetadataPatch>): Promise<Rom | null> {
    const values: Record<string, unknown> = {};
    if (patch.coverUrl !== undefined) values.coverUrl = patch.coverUrl;
    if (patch.coverProvider !== undefined) values.coverProvider = patch.coverProvider;
    if (patch.raGameId !== undefined) values.raGameId = patch.raGameId;
    if (patch.achievementsSummary !== undefined) values.achievementsSummary = patch.achievementsSummary;
    if (Object.keys(values).length === 0) return this.getRom(id);
    const [row] = await this.db
      .update(roms)
      .set(values)
      .where(eq(roms.id, id))
      .returning();
    return row ? toRom(row) : null;
  }

  async listCollections(): Promise<Collection[]> {
    const rows = await this.db.select().from(collections);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      isPublic: row.isPublic,
      ownerId: row.ownerId,
      romIds: [],
    }));
  }

  async findUserByEmail(email: string): Promise<UserWithSecret | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    return row ? toUserWithSecret(row) : null;
  }

  async findUserById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toUser(row) : null;
  }

  async createUser(input: NewUser): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        email: input.email.toLowerCase(),
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        role: input.role ?? "user",
        avatarHue: Math.floor(Math.random() * 360),
      })
      .returning();
    return toUser(row!);
  }

  async listUsers(): Promise<User[]> {
    const rows = await this.db.select().from(users).orderBy(desc(users.createdAt));
    return rows.map(toUser);
  }

  async createSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.db
      .insert(sessions)
      .values({ userId, tokenHash, expiresAt })
      .onConflictDoNothing();
  }

  async findUserBySessionToken(tokenHash: string): Promise<User | null> {
    const [row] = await this.db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, tokenHash), sql`${sessions.expiresAt} > now()`))
      .limit(1);
    return row ? toUser(row.user) : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }

  async stats(): Promise<AdminStats> {
    const [[romStats], [userCount], [platformCount], events] = await Promise.all([
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          playtime: sql<number>`coalesce(sum(${roms.playtimeHours}), 0)::int`,
          storage: sql<number>`coalesce(sum(${roms.sizeMb}), 0)::int`,
        })
        .from(roms),
      this.db.select({ total: sql<number>`count(*)::int` }).from(users),
      this.db.select({ total: sql<number>`count(*)::int` }).from(platforms),
      this.db
        .select({
          id: adminEvents.id,
          action: adminEvents.action,
          createdAt: adminEvents.createdAt,
          actorEmail: users.email,
        })
        .from(adminEvents)
        .leftJoin(users, eq(users.id, adminEvents.actorId))
        .orderBy(desc(adminEvents.createdAt))
        .limit(10),
    ]);

    return {
      totalRoms: romStats?.total ?? 0,
      totalPlaytimeHours: romStats?.playtime ?? 0,
      storageMb: romStats?.storage ?? 0,
      totalUsers: userCount?.total ?? 0,
      totalPlatforms: platformCount?.total ?? 0,
      recentEvents: events.map((e) => ({
        id: e.id,
        action: e.action,
        actorEmail: e.actorEmail ?? "system",
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}

// ─── row mappers ────────────────────────────────────────────────────────────

type RomRow = {
  id: string;
  title: string;
  sortTitle: string;
  platformSlug: string;
  year: number;
  genre: string;
  players: number;
  rating: string;
  region: string;
  sizeMb: string | number; // numeric columns come back as strings from pg drivers
  description: string;
  favorite: boolean;
  playtimeHours: number;
  lastPlayedAt: Date | null;
  coverSeed: number;
  filePath: string;
  addedAt: Date;
  coverUrl: string | null;
  coverProvider: string;
  raGameId: number | null;
  raConsoleId: number | null;
  achievementsSummary: unknown; // jsonb — cast in toRom
};

function toRom(row: RomRow): Rom {
  return {
    ...row,
    rating: Number(row.rating),
    sizeMb: Number(row.sizeMb),
    region: row.region as Rom["region"],
    coverProvider: row.coverProvider as CoverProvider,
    lastPlayedAt: row.lastPlayedAt ? row.lastPlayedAt.toISOString() : null,
    addedAt: row.addedAt.toISOString(),
    achievements:
      (row.achievementsSummary as AchievementSummary | null) ?? summaryFor(row as unknown as Rom),
  };
}

type UserRow = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  avatarHue: number;
  createdAt: Date;
  passwordHash: string;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role === "admin" ? "admin" : "user",
    avatarHue: row.avatarHue,
    createdAt: row.createdAt.toISOString(),
  };
}

function toUserWithSecret(row: UserRow): UserWithSecret {
  return { ...toUser(row), passwordHash: row.passwordHash };
}
