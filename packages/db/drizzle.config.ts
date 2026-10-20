import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit config.
 *
 * `DATABASE_URL_UNPOOLED` (direct connection) is intentionally used here:
 * migrations need session features that PgBouncer transaction pooling strips.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
