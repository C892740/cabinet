/**
 * ROM blob repository — the chunked ROM-file store behind /api/roms/[id]/rom.
 *
 * Same contract as repo.ts / cloud-repo.ts:
 *   • demo — in-memory maps, so `npm run dev` works with zero setup
 *   • neon — Drizzle ORM against Neon Postgres (see packages/db)
 *
 * Chunks are base64 text (like save_states.state) because HTTP serverless
 * drivers round-trip text reliably; chunk rows stay small enough that every
 * request fits comfortably inside serverless body limits.
 */

import type { RomBlobMeta } from "./rom-sync";

export interface NewRomBlob {
  romId: string;
  fileName: string;
  sizeBytes: number;
  chunkSize: number;
  totalChunks: number;
}

export interface RomBlobRepo {
  readonly kind: "demo" | "neon";
  getMeta(userId: string, romId: string): Promise<RomBlobMeta | null>;
  putChunk(userId: string, blob: NewRomBlob, index: number, data: string): Promise<void>;
  getChunk(userId: string, romId: string, index: number): Promise<string | null>;
  deleteBlob(userId: string, romId: string): Promise<boolean>;
}

// Kept on globalThis so every route bundle shares one instance (see repo.ts).
const store = globalThis as typeof globalThis & { __cabinetRomBlobRepo?: RomBlobRepo };

export function getRomBlobRepo(): RomBlobRepo {
  if (store.__cabinetRomBlobRepo) return store.__cabinetRomBlobRepo;
  store.__cabinetRomBlobRepo = process.env.DATABASE_URL
    ? new NeonRomBlobRepo()
    : createDemoRomBlobRepo();
  return store.__cabinetRomBlobRepo;
}

// ─── Demo implementation ────────────────────────────────────────────────────

function createDemoRomBlobRepo(): RomBlobRepo {
  const blobs = new Map<string, { userId: string; meta: RomBlobMeta }>();
  const chunks = new Map<string, string>(); // `${userId}:${romId}:${index}` -> base64
  const key = (userId: string, romId: string) => `${userId}:${romId}`;

  return {
    kind: "demo",

    async getMeta(userId, romId) {
      const entry = blobs.get(key(userId, romId));
      return entry ? { ...entry.meta } : null;
    },

    async putChunk(userId, blob, index, data) {
      blobs.set(key(userId, blob.romId), {
        userId,
        meta: {
          romId: blob.romId,
          fileName: blob.fileName,
          sizeBytes: blob.sizeBytes,
          chunkSize: blob.chunkSize,
          totalChunks: blob.totalChunks,
          updatedAt: new Date().toISOString(),
        },
      });
      chunks.set(`${key(userId, blob.romId)}:${index}`, data);
    },

    async getChunk(userId, romId, index) {
      return chunks.get(`${key(userId, romId)}:${index}`) ?? null;
    },

    async deleteBlob(userId, romId) {
      const existed = blobs.delete(key(userId, romId));
      for (const chunkKey of [...chunks.keys()]) {
        if (chunkKey.startsWith(`${key(userId, romId)}:`)) chunks.delete(chunkKey);
      }
      return existed;
    },
  };
}

// ─── Neon implementation ────────────────────────────────────────────────────

import { and, eq } from "drizzle-orm";
import { createDb, romBlobChunks, romBlobs, type CabinetDb } from "@cabinet/db";

class NeonRomBlobRepo implements RomBlobRepo {
  readonly kind = "neon" as const;
  private db: CabinetDb;

  constructor(connectionString?: string) {
    this.db = createDb(connectionString);
  }

  async getMeta(userId: string, romId: string): Promise<RomBlobMeta | null> {
    const rows = await this.db
      .select()
      .from(romBlobs)
      .where(and(eq(romBlobs.userId, userId), eq(romBlobs.romId, romId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      romId: row.romId,
      fileName: row.fileName,
      sizeBytes: row.sizeBytes,
      chunkSize: row.chunkSize,
      totalChunks: row.totalChunks,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async putChunk(userId: string, blob: NewRomBlob, index: number, data: string): Promise<void> {
    await this.db
      .insert(romBlobs)
      .values({
        userId,
        romId: blob.romId,
        fileName: blob.fileName,
        sizeBytes: blob.sizeBytes,
        chunkSize: blob.chunkSize,
        totalChunks: blob.totalChunks,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [romBlobs.userId, romBlobs.romId],
        set: {
          fileName: blob.fileName,
          sizeBytes: blob.sizeBytes,
          chunkSize: blob.chunkSize,
          totalChunks: blob.totalChunks,
          updatedAt: new Date(),
        },
      });
    await this.db
      .insert(romBlobChunks)
      .values({ userId, romId: blob.romId, idx: index, data })
      .onConflictDoUpdate({
        target: [romBlobChunks.userId, romBlobChunks.romId, romBlobChunks.idx],
        set: { data },
      });
  }

  async getChunk(userId: string, romId: string, index: number): Promise<string | null> {
    const rows = await this.db
      .select({ data: romBlobChunks.data })
      .from(romBlobChunks)
      .where(
        and(
          eq(romBlobChunks.userId, userId),
          eq(romBlobChunks.romId, romId),
          eq(romBlobChunks.idx, index),
        ),
      )
      .limit(1);
    return rows[0]?.data ?? null;
  }

  async deleteBlob(userId: string, romId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(romBlobs)
      .where(and(eq(romBlobs.userId, userId), eq(romBlobs.romId, romId)))
      .returning();
    await this.db
      .delete(romBlobChunks)
      .where(and(eq(romBlobChunks.userId, userId), eq(romBlobChunks.romId, romId)));
    return deleted.length > 0;
  }
}
