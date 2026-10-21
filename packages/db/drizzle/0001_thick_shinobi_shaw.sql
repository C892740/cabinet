CREATE TABLE IF NOT EXISTS "ra_cache" (
	"key" varchar(160) PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "roms" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "roms" ADD COLUMN "cover_provider" varchar(20) DEFAULT 'generated' NOT NULL;--> statement-breakpoint
ALTER TABLE "roms" ADD COLUMN "ra_game_id" integer;--> statement-breakpoint
ALTER TABLE "roms" ADD COLUMN "ra_console_id" integer;