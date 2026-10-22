CREATE TABLE IF NOT EXISTS "device_pairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code" varchar(8) NOT NULL,
	"device_name" varchar(120) DEFAULT '' NOT NULL,
	"phone_name" varchar(120) DEFAULT '' NOT NULL,
	"phone_model" varchar(120) DEFAULT '' NOT NULL,
	"status" varchar(12) DEFAULT 'waiting' NOT NULL,
	"tv_ip" varchar(64) DEFAULT '' NOT NULL,
	"phone_ip" varchar(64) DEFAULT '' NOT NULL,
	"same_network" boolean DEFAULT false NOT NULL,
	"tv_last_seen_at" timestamp with time zone,
	"phone_last_seen_at" timestamp with time zone,
	"linked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "device_pairs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_pairs" ADD CONSTRAINT "device_pairs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "device_pairs_code_unique" ON "device_pairs" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "device_pairs_user_idx" ON "device_pairs" USING btree ("user_id");