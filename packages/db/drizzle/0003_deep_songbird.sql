CREATE TABLE IF NOT EXISTS "emulator_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"platform_slug" varchar(64),
	"emulator_path" text NOT NULL,
	"core_path" text DEFAULT '' NOT NULL,
	"args_template" text DEFAULT '{rom}' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "netplay_messages" (
	"seq" serial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"from_role" varchar(8) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "netplay_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(12) NOT NULL,
	"host_user_id" uuid,
	"host_name" varchar(120) DEFAULT '' NOT NULL,
	"rom_id" uuid,
	"game_title" varchar(200) DEFAULT '' NOT NULL,
	"core" varchar(32) DEFAULT '' NOT NULL,
	"status" varchar(12) DEFAULT 'lobby' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "netplay_sessions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "play_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rom_id" uuid NOT NULL,
	"source" varchar(16) DEFAULT 'browser' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "save_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rom_id" uuid NOT NULL,
	"slot" integer DEFAULT 0 NOT NULL,
	"label" varchar(120) DEFAULT '' NOT NULL,
	"state" text NOT NULL,
	"thumbnail" text,
	"core" varchar(32) DEFAULT '' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "screenshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"rom_id" uuid NOT NULL,
	"image_data" text NOT NULL,
	"caption" varchar(200) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "emulator_profiles" ADD CONSTRAINT "emulator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "emulator_profiles" ADD CONSTRAINT "emulator_profiles_platform_slug_platforms_slug_fk" FOREIGN KEY ("platform_slug") REFERENCES "public"."platforms"("slug") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "netplay_messages" ADD CONSTRAINT "netplay_messages_session_id_netplay_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."netplay_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "netplay_sessions" ADD CONSTRAINT "netplay_sessions_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "netplay_sessions" ADD CONSTRAINT "netplay_sessions_rom_id_roms_id_fk" FOREIGN KEY ("rom_id") REFERENCES "public"."roms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_rom_id_roms_id_fk" FOREIGN KEY ("rom_id") REFERENCES "public"."roms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "save_states" ADD CONSTRAINT "save_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "save_states" ADD CONSTRAINT "save_states_rom_id_roms_id_fk" FOREIGN KEY ("rom_id") REFERENCES "public"."roms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "screenshots" ADD CONSTRAINT "screenshots_rom_id_roms_id_fk" FOREIGN KEY ("rom_id") REFERENCES "public"."roms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "emulator_profiles_user_idx" ON "emulator_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "netplay_messages_session_idx" ON "netplay_messages" USING btree ("session_id","seq");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "netplay_sessions_code_idx" ON "netplay_sessions" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "play_sessions_user_rom_idx" ON "play_sessions" USING btree ("user_id","rom_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "save_states_user_rom_idx" ON "save_states" USING btree ("user_id","rom_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "screenshots_user_rom_idx" ON "screenshots" USING btree ("user_id","rom_id");