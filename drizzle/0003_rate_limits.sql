CREATE TABLE IF NOT EXISTS "rate_limits" (
	"identifier" varchar(255) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_time" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rate_limits_reset_time" ON "rate_limits" USING btree ("reset_time");
