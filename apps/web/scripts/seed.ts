/**
 * Seed the Neon database with the Cabinet demo dataset.
 *
 *   DATABASE_URL=postgresql://… npm run db:seed
 *
 * Idempotent: primary keys are deterministic UUIDs derived from the demo ids,
 * and every insert uses onConflictDoNothing — safe to re-run at any time.
 *
 * The demo dataset (apps/web/src/lib/demo-data.ts) is the single source of
 * truth, so the deployed library matches the README screenshots exactly.
 */

import { createHash, randomBytes } from "node:crypto";
import { createDb, users, platforms, roms, collections, collectionItems, adminEvents } from "@cabinet/db";
import { collections as demoCollections, platforms as demoPlatforms, roms as demoRoms } from "../src/lib/demo-data";
import { hashPassword } from "../src/lib/password";

/** Deterministic UUID (v4-shaped) from any stable string key. */
function uuidFromKey(key: string): string {
  const h = createHash("sha256").update(`cabinet:${key}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x40; // version 4
  h[8] = (h[8]! & 0x3f) | 0x80; // variant 10xx
  const hex = h.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function main(): Promise<void> {
  const db = createDb();

  // 1) Admin user — owns the seeded collections and appears in the dashboard.
  const adminId = uuidFromKey("user:admin@cabinet.local");
  await db
    .insert(users)
    .values({
      id: adminId,
      email: "admin@cabinet.local",
      displayName: "Alex Admin",
      passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
      role: "admin",
      avatarHue: 265,
    })
    .onConflictDoNothing();
  console.log(`✔ admin user ready (${adminId})`);

  // 2) Platforms
  await db
    .insert(platforms)
    .values(
      demoPlatforms.map((p) => ({
        id: uuidFromKey(`platform:${p.slug}`),
        slug: p.slug,
        name: p.name,
        shortName: p.shortName,
        manufacturer: p.manufacturer,
        releaseYear: p.releaseYear,
        colorA: p.colorA,
        colorB: p.colorB,
      })),
    )
    .onConflictDoNothing();
  console.log(`✔ ${demoPlatforms.length} platforms seeded`);

  // 3) ROMs
  await db
    .insert(roms)
    .values(
      demoRoms.map((r) => ({
        id: uuidFromKey(`rom:${r.id}`),
        title: r.title,
        sortTitle: r.sortTitle,
        platformSlug: r.platformSlug,
        year: r.year,
        genre: r.genre,
        players: r.players,
        rating: r.rating.toFixed(1),
        region: r.region,
        sizeMb: r.sizeMb.toFixed(2),
        description: r.description,
        favorite: r.favorite,
        playtimeHours: r.playtimeHours,
        lastPlayedAt: r.lastPlayedAt ? new Date(r.lastPlayedAt) : null,
        coverSeed: r.coverSeed,
        filePath: r.filePath,
        addedAt: new Date(r.addedAt),
      })),
    )
    .onConflictDoNothing();
  console.log(`✔ ${demoRoms.length} roms seeded`);

  // 4) Collections + membership
  for (const collection of demoCollections) {
    const collectionId = uuidFromKey(`collection:${collection.id}`);
    await db
      .insert(collections)
      .values({
        id: collectionId,
        name: collection.name,
        description: collection.description,
        isPublic: collection.isPublic,
        ownerId: adminId,
      })
      .onConflictDoNothing();
    await db
      .insert(collectionItems)
      .values(collection.romIds.map((romId) => ({ collectionId, romId: uuidFromKey(`rom:${romId}`) })))
      .onConflictDoNothing();
  }
  console.log(`✔ ${demoCollections.length} collections seeded`);

  // 5) A little admin activity so the dashboard isn't empty on day one.
  await db
    .insert(adminEvents)
    .values([
      { id: uuidFromKey("event:scan"), action: "Library scan completed — 3 new games", actorId: adminId },
      { id: uuidFromKey("event:igdb"), action: "Metadata refreshed from IGDB", actorId: null },
      { id: uuidFromKey("event:register"), action: "New user registered", actorId: adminId },
      { id: uuidFromKey("event:unlock"), action: "Admin dashboard unlocked", actorId: adminId },
    ])
    .onConflictDoNothing();
  console.log("✔ admin events seeded");
}

main().then(
  () => {
    console.log("🌱 seed complete");
    process.exit(0);
  },
  (error) => {
    console.error("seed failed:", error);
    process.exit(1);
  },
);
