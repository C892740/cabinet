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
  serial,
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
    // Cover art + RetroAchievements linkage (see apps/web/src/lib/covers.ts).
    coverUrl: text("cover_url"),
    coverProvider: varchar("cover_provider", { length: 20 }).notNull().default("generated"),
    raGameId: integer("ra_game_id"),
    raConsoleId: integer("ra_console_id"),
    // Cached AchievementSummary so listings never fan out to the RA API.
    achievementsSummary: jsonb("achievements_summary"),
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

/**
 * Cached third-party payloads (RetroAchievements game sets, console lists…).
 * RA's docs ask clients to cache aggressively; this keeps serverless calls
 * cold-start friendly and rate-limit polite.
 */
export const raCache = pgTable("ra_cache", {
  key: varchar("key", { length: 160 }).primaryKey(),
  payload: jsonb("payload").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Gameplay sync: save states, screenshots, play history ─────────────────

/**
 * Emulator save states synced to the account. State bytes are base64 in text —
 * friendly to HTTP serverless drivers and small (tens to hundreds of KB).
 */
export const saveStates = pgTable(
  "save_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    romId: uuid("rom_id")
      .notNull()
      .references(() => roms.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull().default(0),
    label: varchar("label", { length: 120 }).notNull().default(""),
    /** Base64-encoded emulator state. */
    state: text("state").notNull(),
    /** Base64 PNG thumbnail of the frame when the state was taken. */
    thumbnail: text("thumbnail"),
    /** Core that produced the state (states are core-specific). */
    core: varchar("core", { length: 32 }).notNull().default(""),
    sizeBytes: integer("size_bytes").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("save_states_user_rom_idx").on(table.userId, table.romId)],
);

/** Screenshots captured in the player and synced to the account. */
export const screenshots = pgTable(
  "screenshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    romId: uuid("rom_id")
      .notNull()
      .references(() => roms.id, { onDelete: "cascade" }),
    /** Base64 PNG. */
    imageData: text("image_data").notNull(),
    caption: varchar("caption", { length: 200 }).notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("screenshots_user_rom_idx").on(table.userId, table.romId)],
);

/** Play history — one row per play session, closed when the player exits. */
export const playSessions = pgTable(
  "play_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    romId: uuid("rom_id")
      .notNull()
      .references(() => roms.id, { onDelete: "cascade" }),
    /** Where the session ran: browser player, desktop emulator or TV. */
    source: varchar("source", { length: 16 }).notNull().default("browser"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds").notNull().default(0),
  },
  (table) => [index("play_sessions_user_rom_idx").on(table.userId, table.romId)],
);

/**
 * Desktop emulator launch profiles (synced so every device knows how to
 * launch a platform). Paths are local to the machine that launches them.
 */
export const emulatorProfiles = pgTable(
  "emulator_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    /** Platform slug, or null for a catch-all profile. */
    platformSlug: varchar("platform_slug", { length: 64 }).references(() => platforms.slug),
    emulatorPath: text("emulator_path").notNull(),
    /** Optional libretro core path (RetroArch-style "-L core"). */
    corePath: text("core_path").notNull().default(""),
    /** Argument template: {rom} {romPath} {core} {emulator} {title} placeholders. */
    argsTemplate: text("args_template").notNull().default("{rom}"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("emulator_profiles_user_idx").on(table.userId)],
);

// ─── Netplay: rooms + polling-based WebRTC signalling ──────────────────────

export const netplaySessions = pgTable(
  "netplay_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Short shareable room code (e.g. "K7QF2"). */
    code: varchar("code", { length: 12 }).notNull().unique(),
    hostUserId: uuid("host_user_id").references(() => users.id, { onDelete: "set null" }),
    hostName: varchar("host_name", { length: 120 }).notNull().default(""),
    romId: uuid("rom_id").references(() => roms.id, { onDelete: "cascade" }),
    gameTitle: varchar("game_title", { length: 200 }).notNull().default(""),
    core: varchar("core", { length: 32 }).notNull().default(""),
    status: varchar("status", { length: 12 }).notNull().default("lobby"), // lobby | live | closed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("netplay_sessions_code_idx").on(table.code)],
);

/**
 * Signalling + lightweight control messages, polled with a sequence cursor.
 * One row per SDP/ICE/bye message; gameplay input travels over the WebRTC
 * data channel once peers are connected, never through here.
 */
export const netplayMessages = pgTable(
  "netplay_messages",
  {
    seq: serial("seq").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => netplaySessions.id, { onDelete: "cascade" }),
    fromRole: varchar("from_role", { length: 8 }).notNull(), // host | guest
    kind: varchar("kind", { length: 16 }).notNull(), // offer | answer | ice | bye | chat
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("netplay_messages_session_idx").on(table.sessionId, table.seq)],
);

// ─── ROM file storage: chunked blobs that stream back over one HTTP response ─

/**
 * One uploaded ROM file per (user, rom). The bytes live in rom_blob_chunks as
 * base64 text chunks (same rationale as save_states.state: serverless HTTP
 * drivers round-trip text reliably) sized to fit inside request body limits.
 */
export const romBlobs = pgTable(
  "rom_blobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    romId: uuid("rom_id")
      .notNull()
      .references(() => roms.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull().default(""),
    sizeBytes: integer("size_bytes").notNull().default(0),
    chunkSize: integer("chunk_size").notNull().default(0),
    totalChunks: integer("total_chunks").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("rom_blobs_user_rom_unique").on(table.userId, table.romId)],
);

/** Chunk rows for one ROM upload; reassembled in idx order when streaming. */
export const romBlobChunks = pgTable(
  "rom_blob_chunks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    romId: uuid("rom_id")
      .notNull()
      .references(() => roms.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    /** Base64-encoded slice of the ROM. */
    data: text("data").notNull(),
  },
  (table) => [
    uniqueIndex("rom_blob_chunks_unique").on(table.userId, table.romId, table.idx),
  ],
);

// ─── Phone ↔ TV linking ("Smart View"-style companion pairing) ──────────────

/**
 * One phone ↔ TV pairing session of an account.
 *
 * The TV (a web app — it cannot open sockets or advertise mDNS) shows a
 * short-lived code; the Cabinet phone app claims it. The server then compares
 * the egress IPs it observes for both sides: equal ⇒ the phone and TV sit
 * behind the same NAT, i.e. the "same Wi-Fi" link the auto-import feature
 * requires. Heartbeats keep both IPs fresh so the check stays honest.
 */
export const devicePairs = pgTable(
  "device_pairs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Short code shown on the TV (e.g. "483-291"). Single-use. */
    code: varchar("code", { length: 8 }).notNull().unique(),
    /** Label of the TV / console shown on the phone. */
    deviceName: varchar("device_name", { length: 120 }).notNull().default(""),
    phoneName: varchar("phone_name", { length: 120 }).notNull().default(""),
    phoneModel: varchar("phone_model", { length: 120 }).notNull().default(""),
    /** waiting → claimed → linked | removed | expired (expired is computed). */
    status: varchar("status", { length: 12 }).notNull().default("waiting"),
    tvIp: varchar("tv_ip", { length: 64 }).notNull().default(""),
    phoneIp: varchar("phone_ip", { length: 64 }).notNull().default(""),
    /** Last comparison of both egress IPs (the "same Wi-Fi" verdict). */
    sameNetwork: boolean("same_network").notNull().default(false),
    tvLastSeenAt: timestamp("tv_last_seen_at", { withTimezone: true }),
    phoneLastSeenAt: timestamp("phone_last_seen_at", { withTimezone: true }),
    linkedAt: timestamp("linked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("device_pairs_code_unique").on(table.code),
    index("device_pairs_user_idx").on(table.userId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type PlatformRow = typeof platforms.$inferSelect;
export type RomRow = typeof roms.$inferSelect;
export type CollectionRow = typeof collections.$inferSelect;
export type AdminEventRow = typeof adminEvents.$inferSelect;
export type RaCacheRow = typeof raCache.$inferSelect;
export type SaveStateRow = typeof saveStates.$inferSelect;
export type ScreenshotRow = typeof screenshots.$inferSelect;
export type PlaySessionRow = typeof playSessions.$inferSelect;
export type EmulatorProfileRow = typeof emulatorProfiles.$inferSelect;
export type NetplaySessionRow = typeof netplaySessions.$inferSelect;
export type NetplayMessageRow = typeof netplayMessages.$inferSelect;
export type RomBlobRow = typeof romBlobs.$inferSelect;
export type RomBlobChunkRow = typeof romBlobChunks.$inferSelect;
export type DevicePairRow = typeof devicePairs.$inferSelect;
