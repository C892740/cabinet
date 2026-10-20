/**
 * Cabinet database schema (Neon Postgres / any Postgres 14+).
 *
 * Design notes:
 *  • Sessions are opaque tokens stored *hashed* — a leaked database row can
 *    never be replayed as a login cookie.
 *  • Passwords use scrypt digests (see apps/web/src/lib/password.ts); nothing
 *    reversible is stored.
 *  • ROM rows reference platform slugs so the demo dataset and scanned
 *    libraries share one vocabulary.
 */

import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 16 }).notNull().default("user"), // 'user' | 'admin'
    avatarHue: integer("avatar_hue").notNull().default(210),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const platforms = pgTable("platforms", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  shortName: varchar("short_name", { length: 32 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 120 }).notNull(),
  releaseYear: integer("release_year").notNull(),
  colorA: varchar("color_a", { length: 7 }).notNull(),
  colorB: varchar("color_b", { length: 7 }).notNull(),
});

export const roms = pgTable(
  "roms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    sortTitle: text("sort_title").notNull(),
    platformSlug: varchar("platform_slug", { length: 64 })
      .notNull()
      .references(() => platforms.slug),
    year: integer("year").notNull(),
    genre: varchar("genre", { length: 64 }).notNull(),
    players: integer("players").notNull().default(1),
    rating: numeric("rating", { precision: 3, scale: 1 }).notNull().default("0"),
    region: varchar("region", { length: 16 }).notNull().default("USA"),
    // Fractional: 8-bit ROMs are well under 1 MB and scanner output is fractional.
    sizeMb: numeric("size_mb", { precision: 8, scale: 2 }).notNull().default("0"),
    description: text("description").notNull().default(""),
    favorite: boolean("favorite").notNull().default(false),
    playtimeHours: integer("playtime_hours").notNull().default(0),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }),
    coverSeed: integer("cover_seed").notNull().default(0),
    filePath: text("file_path").notNull().default(""),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("roms_platform_idx").on(table.platformSlug),
    index("roms_sort_title_idx").on(table.sortTitle),
  ],
);

export const collections = pgTable("collections", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description").notNull().default(""),
  isPublic: boolean("is_public").notNull().default(false),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const collectionItems = pgTable(
  "collection_items",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    romId: uuid("rom_id")
      .notNull()
      .references(() => roms.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("collection_items_unique").on(table.collectionId, table.romId)],
);

export const adminEvents = pgTable(
  "admin_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    action: varchar("action", { length: 120 }).notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("admin_events_created_idx").on(table.createdAt)],
);

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type PlatformRow = typeof platforms.$inferSelect;
export type RomRow = typeof roms.$inferSelect;
export type CollectionRow = typeof collections.$inferSelect;
export type AdminEventRow = typeof adminEvents.$inferSelect;
