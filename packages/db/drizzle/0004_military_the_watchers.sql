CREATE TABLE IF NOT EXISTS "rom_blob_chunks" (
	"user_id" uuid NOT NULL,
	"rom_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rom_blobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rom_id" uuid NOT NULL,
	"file_name" varchar(255) DEFAULT '' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"chunk_size" integer DEFAULT 0 NOT NULL,
	"total_chunks" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rom_blob_chunks" ADD CONSTRAINT "rom_blob_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rom_blob_chunks" ADD CONSTRAINT "rom_blob_chunks_rom_id_roms_id_fk" FOREIGN KEY ("rom_id") REFERENCES "public"."roms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rom_blobs" ADD CONSTRAINT "rom_blobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rom_blobs" ADD CONSTRAINT "rom_blobs_rom_id_roms_id_fk" FOREIGN KEY ("rom_id") REFERENCES "public"."roms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rom_blob_chunks_unique" ON "rom_blob_chunks" USING btree ("user_id","rom_id","idx");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rom_blobs_user_rom_unique" ON "rom_blobs" USING btree ("user_id","rom_id");