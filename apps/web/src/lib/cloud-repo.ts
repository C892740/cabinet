/**
 * Gameplay-sync repository.
 *
 * A sibling to the library `Repo` (repo.ts) with the same shape:
 *   • demo — in-memory maps, so `npm run dev` works with zero setup
 *   • neon — Drizzle ORM against Neon Postgres (see packages/db)
 *
 * Covers everything the emulator wing syncs across devices: save states,
 * screenshots, play history, desktop emulator profiles and netplay rooms.
 */

import type {
  EmulatorProfile,
  NetplayRole,
  NetplaySessionInfo,
  NetplaySignal,
  PlaySession,
  PlaySource,
  SaveState,
  Screenshot,
} from "./types";

export interface NewSaveState {
  romId: string;
  slot?: number;
  label?: string;
  core?: string;
  state: string; // base64
  thumbnail?: string | null; // base64 PNG
}

export interface NewScreenshot {
  romId: string;
  imageData: string; // base64 PNG
  caption?: string;
}

export interface NewPlaySession {
  romId: string;
  source: PlaySource;
  startedAt?: string;
}

export interface NewEmulatorProfile {
  name: string;
  platformSlug: string | null;
  emulatorPath: string;
  corePath?: string;
  argsTemplate?: string;
  isDefault?: boolean;
}

export interface NewNetplayMessage {
  fromRole: NetplayRole;
  kind: NetplaySignal["kind"];
  payload: unknown;
}

export interface CloudRepo {
  readonly kind: "demo" | "neon";

  // save states
  listSaveStates(userId: string, romId: string): Promise<SaveState[]>;
  createSaveState(userId: string, input: NewSaveState): Promise<SaveState>;
  deleteSaveState(userId: string, id: string): Promise<boolean>;

  // screenshots
  listScreenshots(userId: string, romId: string): Promise<Screenshot[]>;
  createScreenshot(userId: string, input: NewScreenshot): Promise<Screenshot>;
  deleteScreenshot(userId: string, id: string): Promise<boolean>;

  // play history
  listPlaySessions(userId: string, romId?: string): Promise<PlaySession[]>;
  startPlaySession(userId: string, input: NewPlaySession): Promise<PlaySession>;
  endPlaySession(userId: string, id: string, durationSeconds: number): Promise<PlaySession | null>;

  // emulator profiles
  listEmulatorProfiles(userId: string): Promise<EmulatorProfile[]>;
  createEmulatorProfile(userId: string, input: NewEmulatorProfile): Promise<EmulatorProfile>;
  updateEmulatorProfile(
    userId: string,
    id: string,
    patch: Partial<NewEmulatorProfile>,
  ): Promise<EmulatorProfile | null>;
  deleteEmulatorProfile(userId: string, id: string): Promise<boolean>;

  // netplay
  createNetplaySession(input: {
    hostUserId: string | null;
    hostName: string;
    gameTitle: string;
    core: string;
    romId: string | null;
  }): Promise<NetplaySessionInfo>;
  getNetplaySession(code: string): Promise<NetplaySessionInfo | null>;
  setNetplayStatus(code: string, status: NetplaySessionInfo["status"]): Promise<void>;
  postNetplayMessage(code: string, message: NewNetplayMessage): Promise<void>;
  readNetplayMessages(code: string, afterSeq: number, forRole: NetplayRole): Promise<NetplaySignal[]>;
}

// Kept on globalThis so every route bundle shares one instance (see repo.ts).
const store = globalThis as typeof globalThis & { __cabinetCloudRepo?: CloudRepo };

export function getCloudRepo(): CloudRepo {
  if (store.__cabinetCloudRepo) return store.__cabinetCloudRepo;
  store.__cabinetCloudRepo = process.env.DATABASE_URL
    ? new NeonCloudRepo()
    : createDemoCloudRepo();
  return store.__cabinetCloudRepo;
}

/** Guard rails so a runaway client can't bloat the database. */
export const MAX_STATE_BYTES = 2_000_000; // decoded
export const MAX_SCREENSHOT_BYTES = 1_500_000; // decoded

export function base64Bytes(data: string): number {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

// ─── Demo implementation ────────────────────────────────────────────────────

function createDemoCloudRepo(): CloudRepo {
  // Demo state is scoped per user exactly like the database rows would be.
  const saveStates = new Map<string, { userId: string; record: SaveState }>();
  const screenshots = new Map<string, { userId: string; record: Screenshot }>();
  const sessions = new Map<string, { userId: string; record: PlaySession }>();
  const profiles = new Map<string, { userId: string; record: EmulatorProfile }>();
  const netplay = new Map<string, { info: NetplaySessionInfo; messages: NetplaySignal[]; seq: number }>();

  const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  const now = () => new Date().toISOString();

  return {
    kind: "demo",

    async listSaveStates(userId, romId) {
      return [...saveStates.values()]
        .filter((s) => s.userId === userId && s.record.romId === romId)
        .map((s) => s.record)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async createSaveState(userId, input) {
      const state: SaveState = {
        id: uid("ss"),
        romId: input.romId,
        slot: input.slot ?? 0,
        label: input.label ?? "",
        core: input.core ?? "",
        sizeBytes: base64Bytes(input.state),
        thumbnail: input.thumbnail ?? null,
        state: input.state,
        createdAt: now(),
        updatedAt: now(),
      };
      saveStates.set(state.id, { userId, record: state });
      return state;
    },

    async deleteSaveState(userId, id) {
      const entry = saveStates.get(id);
      if (!entry || entry.userId !== userId) return false;
      return saveStates.delete(id);
    },

    async listScreenshots(userId, romId) {
      return [...screenshots.values()]
        .filter((s) => s.userId === userId && s.record.romId === romId)
        .map((s) => s.record)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async createScreenshot(userId, input) {
      const shot: Screenshot = {
        id: uid("sc"),
        romId: input.romId,
        caption: input.caption ?? "",
        imageData: input.imageData,
        createdAt: now(),
      };
      screenshots.set(shot.id, { userId, record: shot });
      return shot;
    },

    async deleteScreenshot(userId, id) {
      const entry = screenshots.get(id);
      if (!entry || entry.userId !== userId) return false;
      return screenshots.delete(id);
    },

    async listPlaySessions(userId, romId) {
      return [...sessions.values()]
        .filter((s) => s.userId === userId && (!romId || s.record.romId === romId))
        .map((s) => s.record)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },

    async startPlaySession(userId, input) {
      const session: PlaySession = {
        id: uid("ps"),
        romId: input.romId,
        source: input.source,
        startedAt: input.startedAt ?? now(),
        endedAt: null,
        durationSeconds: 0,
      };
      sessions.set(session.id, { userId, record: session });
      return session;
    },

    async endPlaySession(userId, id, durationSeconds) {
      const entry = sessions.get(id);
      if (!entry || entry.userId !== userId) return null;
      entry.record.endedAt = now();
      entry.record.durationSeconds = durationSeconds;
      return entry.record;
    },

    async listEmulatorProfiles(userId) {
      return [...profiles.values()]
        .filter((p) => p.userId === userId)
        .map((p) => p.record)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async createEmulatorProfile(userId, input) {
      const profile: EmulatorProfile = {
        id: uid("ep"),
        name: input.name,
        platformSlug: input.platformSlug,
        emulatorPath: input.emulatorPath,
        corePath: input.corePath ?? "",
        argsTemplate: input.argsTemplate ?? "{rom}",
        isDefault: input.isDefault ?? false,
        createdAt: now(),
        updatedAt: now(),
      };
      profiles.set(profile.id, { userId, record: profile });
      return profile;
    },

    async updateEmulatorProfile(userId, id, patch) {
      const entry = profiles.get(id);
      if (!entry || entry.userId !== userId) return null;
      Object.assign(entry.record, patch, { updatedAt: now() });
      return entry.record;
    },

    async deleteEmulatorProfile(userId, id) {
      const entry = profiles.get(id);
      if (!entry || entry.userId !== userId) return false;
      return profiles.delete(id);
    },

    async createNetplaySession(input) {
      const code = randomRoomCode();
      const info: NetplaySessionInfo = {
        code,
        hostName: input.hostName,
        gameTitle: input.gameTitle,
        core: input.core,
        romId: input.romId,
        status: "lobby",
        createdAt: now(),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      };
      netplay.set(code, { info, messages: [], seq: 0 });
      return info;
    },

    async getNetplaySession(code) {
      const entry = netplay.get(code);
      return entry && new Date(entry.info.expiresAt) > new Date() ? entry.info : null;
    },

    async setNetplayStatus(code, status) {
      const entry = netplay.get(code);
      if (entry) entry.info.status = status;
    },

    async postNetplayMessage(code, message) {
      const entry = netplay.get(code);
      if (!entry) return;
      entry.seq += 1;
      entry.messages.push({
        seq: entry.seq,
        fromRole: message.fromRole,
        kind: message.kind,
        payload: message.payload,
        createdAt: now(),
      });
    },

    async readNetplayMessages(code, afterSeq, forRole) {
      const entry = netplay.get(code);
      if (!entry) return [];
      return entry.messages.filter((m) => m.seq > afterSeq && m.fromRole !== forRole);
    },
  };
}

function randomRoomCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

// ─── Neon implementation ────────────────────────────────────────────────────

import { and, desc, eq, gt } from "drizzle-orm";
import {
  createDb,
  emulatorProfiles,
  netplayMessages,
  netplaySessions,
  playSessions,
  saveStates,
  screenshots,
  type CabinetDb,
} from "@cabinet/db";

class NeonCloudRepo implements CloudRepo {
  readonly kind = "neon" as const;
  private db: CabinetDb;

  constructor(connectionString?: string) {
    this.db = createDb(connectionString);
  }

  async listSaveStates(userId: string, romId: string): Promise<SaveState[]> {
    const rows = await this.db
      .select()
      .from(saveStates)
      .where(and(eq(saveStates.userId, userId), eq(saveStates.romId, romId)))
      .orderBy(desc(saveStates.updatedAt))
      .limit(30);
    return rows.map((row) => ({
      id: row.id,
      romId: row.romId,
      slot: row.slot,
      label: row.label,
      core: row.core,
      sizeBytes: row.sizeBytes,
      thumbnail: row.thumbnail,
      state: row.state,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async createSaveState(userId: string, input: NewSaveState): Promise<SaveState> {
    const [row] = await this.db
      .insert(saveStates)
      .values({
        userId,
        romId: input.romId,
        slot: input.slot ?? 0,
        label: input.label ?? "",
        core: input.core ?? "",
        state: input.state,
        thumbnail: input.thumbnail ?? null,
        sizeBytes: base64Bytes(input.state),
      })
      .returning();
    return {
      id: row!.id,
      romId: row!.romId,
      slot: row!.slot,
      label: row!.label,
      core: row!.core,
      sizeBytes: row!.sizeBytes,
      thumbnail: row!.thumbnail,
      state: row!.state,
      createdAt: row!.createdAt.toISOString(),
      updatedAt: row!.updatedAt.toISOString(),
    };
  }

  async deleteSaveState(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(saveStates)
      .where(and(eq(saveStates.id, id), eq(saveStates.userId, userId)))
      .returning();
    return rows.length > 0;
  }

  async listScreenshots(userId: string, romId: string): Promise<Screenshot[]> {
    const rows = await this.db
      .select()
      .from(screenshots)
      .where(and(eq(screenshots.userId, userId), eq(screenshots.romId, romId)))
      .orderBy(desc(screenshots.createdAt))
      .limit(30);
    return rows.map((row) => ({
      id: row.id,
      romId: row.romId,
      caption: row.caption,
      imageData: row.imageData,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async createScreenshot(userId: string, input: NewScreenshot): Promise<Screenshot> {
    const [row] = await this.db
      .insert(screenshots)
      .values({
        userId,
        romId: input.romId,
        imageData: input.imageData,
        caption: input.caption ?? "",
      })
      .returning();
    return {
      id: row!.id,
      romId: row!.romId,
      caption: row!.caption,
      imageData: row!.imageData,
      createdAt: row!.createdAt.toISOString(),
    };
  }

  async deleteScreenshot(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(screenshots)
      .where(and(eq(screenshots.id, id), eq(screenshots.userId, userId)))
      .returning();
    return rows.length > 0;
  }    async listPlaySessions(userId: string, romId?: string): Promise<PlaySession[]> {
    const rows = await this.db
      .select()
      .from(playSessions)
      .where(
        romId
          ? and(eq(playSessions.userId, userId), eq(playSessions.romId, romId))
          : eq(playSessions.userId, userId),
      )
      .orderBy(desc(playSessions.startedAt))
      .limit(50);
    return rows.map((row) => toPlaySession(row as unknown as PlaySessionRowLike));
  }

  async startPlaySession(userId: string, input: NewPlaySession): Promise<PlaySession> {
    const [row] = await this.db
      .insert(playSessions)
      .values({
        userId,
        romId: input.romId,
        source: input.source,
        startedAt: input.startedAt ? new Date(input.startedAt) : undefined,
      })
      .returning();
    return toPlaySession(row! as unknown as PlaySessionRowLike);
  }

  async endPlaySession(
    userId: string,
    id: string,
    durationSeconds: number,
  ): Promise<PlaySession | null> {
    const [row] = await this.db
      .update(playSessions)
      .set({ endedAt: new Date(), durationSeconds })
      .where(and(eq(playSessions.id, id), eq(playSessions.userId, userId)))
      .returning();
    return row ? toPlaySession(row as unknown as PlaySessionRowLike) : null;
  }

  async listEmulatorProfiles(userId: string): Promise<EmulatorProfile[]> {
    const rows = await this.db
      .select()
      .from(emulatorProfiles)
      .where(eq(emulatorProfiles.userId, userId))
      .orderBy(emulatorProfiles.name);
    return rows.map((row) => toProfile(row as unknown as ProfileRowLike));
  }

  async createEmulatorProfile(userId: string, input: NewEmulatorProfile): Promise<EmulatorProfile> {
    const [row] = await this.db
      .insert(emulatorProfiles)
      .values({
        userId,
        name: input.name,
        platformSlug: input.platformSlug,
        emulatorPath: input.emulatorPath,
        corePath: input.corePath ?? "",
        argsTemplate: input.argsTemplate ?? "{rom}",
        isDefault: input.isDefault ?? false,
      })
      .returning();
    return toProfile(row! as unknown as ProfileRowLike);
  }

  async updateEmulatorProfile(
    userId: string,
    id: string,
    patch: Partial<NewEmulatorProfile>,
  ): Promise<EmulatorProfile | null> {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.platformSlug !== undefined) values.platformSlug = patch.platformSlug;
    if (patch.emulatorPath !== undefined) values.emulatorPath = patch.emulatorPath;
    if (patch.corePath !== undefined) values.corePath = patch.corePath;
    if (patch.argsTemplate !== undefined) values.argsTemplate = patch.argsTemplate;
    if (patch.isDefault !== undefined) values.isDefault = patch.isDefault;
    const [row] = await this.db
      .update(emulatorProfiles)
      .set(values)
      .where(and(eq(emulatorProfiles.id, id), eq(emulatorProfiles.userId, userId)))
      .returning();
    return row ? toProfile(row as unknown as ProfileRowLike) : null;
  }

  async deleteEmulatorProfile(userId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .delete(emulatorProfiles)
      .where(and(eq(emulatorProfiles.id, id), eq(emulatorProfiles.userId, userId)))
      .returning();
    return rows.length > 0;
  }

  async createNetplaySession(input: {
    hostUserId: string | null;
    hostName: string;
    gameTitle: string;
    core: string;
    romId: string | null;
  }): Promise<NetplaySessionInfo> {
    // Retry on the (unlikely) room-code collision.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = randomRoomCode();
      try {
        const [row] = await this.db
          .insert(netplaySessions)
          .values({
            code,
            hostUserId: input.hostUserId,
            hostName: input.hostName,
            gameTitle: input.gameTitle,
            core: input.core,
            romId: input.romId,
            status: "lobby",
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          })
          .returning();
        return toNetplayInfo(row! as unknown as NetplayRowLike);
      } catch {
        // unique violation → new code
      }
    }
    throw new Error("could not allocate a netplay room code");
  }

  async getNetplaySession(code: string): Promise<NetplaySessionInfo | null> {
    const [row] = await this.db
      .select()
      .from(netplaySessions)
      .where(and(eq(netplaySessions.code, code.toUpperCase()), gt(netplaySessions.expiresAt, new Date())))
      .limit(1);
    return row ? toNetplayInfo(row as unknown as NetplayRowLike) : null;
  }

  async setNetplayStatus(code: string, status: NetplaySessionInfo["status"]): Promise<void> {
    await this.db
      .update(netplaySessions)
      .set({ status })
      .where(eq(netplaySessions.code, code.toUpperCase()));
  }

  async postNetplayMessage(code: string, message: NewNetplayMessage): Promise<void> {
    const session = await this.db
      .select({ id: netplaySessions.id })
      .from(netplaySessions)
      .where(eq(netplaySessions.code, code.toUpperCase()))
      .limit(1);
    if (!session[0]) return;
    await this.db.insert(netplayMessages).values({
      sessionId: session[0].id,
      fromRole: message.fromRole,
      kind: message.kind,
      payload: message.payload as never,
    });
  }

  async readNetplayMessages(
    code: string,
    afterSeq: number,
    forRole: NetplayRole,
  ): Promise<NetplaySignal[]> {
    const session = await this.db
      .select({ id: netplaySessions.id })
      .from(netplaySessions)
      .where(eq(netplaySessions.code, code.toUpperCase()))
      .limit(1);
    if (!session[0]) return [];
    const otherRole = forRole === "host" ? "guest" : "host";
    const rows = await this.db
      .select()
      .from(netplayMessages)
      .where(
        and(
          eq(netplayMessages.sessionId, session[0].id),
          gt(netplayMessages.seq, afterSeq),
          eq(netplayMessages.fromRole, otherRole),
        ),
      )
      .orderBy(netplayMessages.seq)
      .limit(50);
    return rows.map((row) => ({
      seq: row.seq,
      fromRole: row.fromRole as NetplayRole,
      kind: row.kind as NetplaySignal["kind"],
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}

// Row shapes the mappers accept. The HTTP serverless driver types rows loosely
// (`{ [x: string]: any }`), so call sites cast to these structural shapes.
type PlaySessionRowLike = Parameters<typeof toPlaySession>[0];
type ProfileRowLike = Parameters<typeof toProfile>[0];
type NetplayRowLike = Parameters<typeof toNetplayInfo>[0];

function toPlaySession(row: {
  id: string;
  romId: string;
  source: string;
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number;
}): PlaySession {
  return {
    id: row.id,
    romId: row.romId,
    source: row.source as PlaySource,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    durationSeconds: row.durationSeconds,
  };
}

function toProfile(row: {
  id: string;
  name: string;
  platformSlug: string | null;
  emulatorPath: string;
  corePath: string;
  argsTemplate: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): EmulatorProfile {
  return {
    id: row.id,
    name: row.name,
    platformSlug: row.platformSlug,
    emulatorPath: row.emulatorPath,
    corePath: row.corePath,
    argsTemplate: row.argsTemplate,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toNetplayInfo(row: {
  code: string;
  hostName: string;
  gameTitle: string;
  core: string;
  romId: string | null;
  status: string;
  createdAt: Date;
  expiresAt: Date;
}): NetplaySessionInfo {
  return {
    code: row.code,
    hostName: row.hostName,
    gameTitle: row.gameTitle,
    core: row.core,
    romId: row.romId,
    status: row.status as NetplaySessionInfo["status"],
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}
