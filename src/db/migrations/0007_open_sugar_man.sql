DO $$ BEGIN
  CREATE TYPE "lms"."file_delivery" AS ENUM('signed', 'cdn');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "lms"."file_purpose" AS ENUM('lesson_document', 'lesson_image', 'avatar', 'submission', 'payment_proof', 'scorm_package');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "lms"."file_status" AS ENUM('pending', 'uploaded', 'verified', 'rejected', 'deleted');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lms"."files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"purpose" "lms"."file_purpose" NOT NULL,
	"delivery" "lms"."file_delivery" NOT NULL,
	"public_key" text,
	"status" "lms"."file_status" DEFAULT 'pending' NOT NULL,
	"declared_mime" text NOT NULL,
	"detected_mime" text,
	"size_bytes" bigint NOT NULL,
	"sha256" text,
	"storage_key" text NOT NULL,
	"rejection_reason" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lms"."storage_reads" (
	"day" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lms"."files" ADD CONSTRAINT "files_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "lms"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_owner_id_idx" ON "lms"."files" USING btree ("owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_status_idx" ON "lms"."files" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_purpose_idx" ON "lms"."files" USING btree ("purpose");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "files_public_key_idx" ON "lms"."files" USING btree ("public_key");