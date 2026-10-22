/**
 * Phone ↔ TV pairing repository (the "Smart View"-style link).
 *
 * Same contract as repo.ts / rom-blob-repo.ts:
 *   • demo — in-memory maps, so `npm run dev` works with zero setup
 *   • neon — Drizzle ORM against Neon Postgres (see packages/db)
 *
 * The wire shape (PairView) is what the TV panel and the mobile apps share;
 * routes never leak rows straight out.
 */

export type PairStatus = "waiting" | "claimed" | "linked" | "removed";

export interface PairView {
  code: string;
  deviceName: string;
  phoneName: string;
  phoneModel: string;
  status: PairStatus;
  sameNetwork: boolean;
  linkedAt: string | null;
  tvLastSeenAt: string | null;
  phoneLastSeenAt: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface NewPair {
  userId: string;
  code: string;
  deviceName: string;
  expiresAt: Date;
}

export interface PairPatch {
  phoneName?: string;
  phoneModel?: string;
  status?: PairStatus;
  tvIp?: string;
  phoneIp?: string;
  sameNetwork?: boolean;
  tvLastSeenAt?: Date;
  phoneLastSeenAt?: Date;
  linkedAt?: Date | null;
  expiresAt?: Date;
}

/** Full record including the egress IPs used for the same-network verdict. */
export interface PairRecord extends PairView {
  userId: string;
  tvIp: string;
  phoneIp: string;
}

export interface PairRepo {
  readonly kind: "demo" | "neon";
  /** Replace every open (waiting/claimed) code of this user with one fresh code. */
  createPair(pair: NewPair): Promise<PairRecord>;
  getPairByCode(code: string): Promise<PairRecord | null>;
  updatePair(code: string, patch: PairPatch): Promise<PairRecord | null>;
  listPairs(userId: string, linkedOnly?: boolean): Promise<PairRecord[]>;
  removePair(userId: string, code: string): Promise<boolean>;
}

// Kept on globalThis so every route bundle shares one instance (see repo.ts).
const store = globalThis as typeof globalThis & { __cabinetPairRepo?: PairRepo };

export function getPairRepo(): PairRepo {
  if (store.__cabinetPairRepo) return store.__cabinetPairRepo;
  store.__cabinetPairRepo = process.env.DATABASE_URL
    ? new NeonPairRepo()
    : createDemoPairRepo();
  return store.__cabinetPairRepo;
}

export function pairView(pair: PairRecord): PairView {
  const { userId: _u, tvIp: _t, phoneIp: _p, ...view } = pair;
  return view;
}

// ─── Demo implementation ────────────────────────────────────────────────────

function createDemoPairRepo(): PairRepo {
  const pairs = new Map<string, PairRecord>(); // code -> record

  return {
    kind: "demo",

    async createPair(pair) {
      for (const [code, record] of [...pairs]) {
        if (record.userId === pair.userId && (record.status === "waiting" || record.status === "claimed")) {
          pairs.delete(code);
        }
      }
      const record: PairRecord = {
        userId: pair.userId,
        code: pair.code,
        deviceName: pair.deviceName,
        phoneName: "",
        phoneModel: "",
        status: "waiting",
        sameNetwork: false,
        tvIp: "",
        phoneIp: "",
        linkedAt: null,
        tvLastSeenAt: null,
        phoneLastSeenAt: null,
        createdAt: new Date().toISOString(),
        expiresAt: pair.expiresAt.toISOString(),
      };
      pairs.set(pair.code, record);
      return { ...record };
    },

    async getPairByCode(code) {
      const record = pairs.get(code);
      return record ? { ...record } : null;
    },

    async updatePair(code, patch) {
      const record = pairs.get(code);
      if (!record) return null;
      const updated: PairRecord = {
        ...record,
        ...patch,
        linkedAt:
          patch.linkedAt === undefined
            ? record.linkedAt
            : patch.linkedAt
              ? patch.linkedAt.toISOString()
              : null,
        tvLastSeenAt:
          patch.tvLastSeenAt === undefined
            ? record.tvLastSeenAt
            : patch.tvLastSeenAt
              ? patch.tvLastSeenAt.toISOString()
              : null,
        phoneLastSeenAt:
          patch.phoneLastSeenAt === undefined
            ? record.phoneLastSeenAt
            : patch.phoneLastSeenAt
              ? patch.phoneLastSeenAt.toISOString()
              : null,
        expiresAt: patch.expiresAt ? patch.expiresAt.toISOString() : record.expiresAt,
        createdAt: record.createdAt,
      };
      pairs.set(code, updated);
      return { ...updated };
    },

    async listPairs(userId, linkedOnly = true) {
      return [...pairs.values()]
        .filter((record) => record.userId === userId && (!linkedOnly || record.status === "linked"))
        .map((record) => ({ ...record }));
    },

    async removePair(userId, code) {
      const record = pairs.get(code);
      if (!record || record.userId !== userId) return false;
      return pairs.delete(code);
    },
  };
}

// ─── Neon implementation ────────────────────────────────────────────────────

import { and, eq, inArray } from "drizzle-orm";
import { createDb, devicePairs, type CabinetDb, type DevicePairRow } from "@cabinet/db";

function toRecord(row: DevicePairRow): PairRecord {
  return {
    userId: row.userId,
    code: row.code,
    deviceName: row.deviceName,
    phoneName: row.phoneName,
    phoneModel: row.phoneModel,
    status: row.status as PairStatus,
    sameNetwork: row.sameNetwork,
    tvIp: row.tvIp,
    phoneIp: row.phoneIp,
    linkedAt: row.linkedAt ? row.linkedAt.toISOString() : null,
    tvLastSeenAt: row.tvLastSeenAt ? row.tvLastSeenAt.toISOString() : null,
    phoneLastSeenAt: row.phoneLastSeenAt ? row.phoneLastSeenAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

class NeonPairRepo implements PairRepo {
  readonly kind = "neon" as const;
  private db: CabinetDb;

  constructor(connectionString?: string) {
    this.db = createDb(connectionString);
  }

  async createPair(pair: NewPair): Promise<PairRecord> {
    await this.db
      .delete(devicePairs)
      .where(
        and(
          eq(devicePairs.userId, pair.userId),
          inArray(devicePairs.status, ["waiting", "claimed"]),
        ),
      );
    const rows = await this.db
      .insert(devicePairs)
      .values({
        userId: pair.userId,
        code: pair.code,
        deviceName: pair.deviceName,
        expiresAt: pair.expiresAt,
      })
      .returning();
    return toRecord(rows[0]!);
  }

  async getPairByCode(code: string): Promise<PairRecord | null> {
    const rows = await this.db.select().from(devicePairs).where(eq(devicePairs.code, code)).limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async updatePair(code: string, patch: PairPatch): Promise<PairRecord | null> {
    const rows = await this.db
      .update(devicePairs)
      .set(patch)
      .where(eq(devicePairs.code, code))
      .returning();
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async listPairs(userId: string, linkedOnly = true): Promise<PairRecord[]> {
    const rows = await this.db.select().from(devicePairs).where(eq(devicePairs.userId, userId));
    return rows
      .filter((row) => !linkedOnly || row.status === "linked")
      .map(toRecord);
  }

  async removePair(userId: string, code: string): Promise<boolean> {
    const deleted = await this.db
      .delete(devicePairs)
      .where(and(eq(devicePairs.userId, userId), eq(devicePairs.code, code)))
      .returning();
    return deleted.length > 0;
  }
}
