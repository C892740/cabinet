/**
 * Postgres client factory.
 *
 * • Neon URLs (*.neon.tech) use Neon's HTTP serverless driver — the right
 *   transport for short-lived serverless functions on Vercel. Pair it with the
 *   *pooled* connection string (Neon "-pooler" host) for runtime, and keep the
 *   direct URL for migrations.
 * • Any other URL (e.g. a local Postgres for development and CI) falls back to
 *   a plain node-postgres pool — so `npm run dev` and the seed script work
 *   against a local database too.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type CabinetDb = NeonHttpDatabase<typeof schema> | NodePgDatabase<typeof schema>;

export function createDb(connectionString?: string): CabinetDb {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add a Neon connection string to your environment (see .env.example).",
    );
  }
  if (url.includes(".neon.tech")) {
    return drizzleNeon(neon(url), { schema });
  }
  return drizzlePg(new Pool({ connectionString: url }), { schema });
}

export * from "./schema.js";
