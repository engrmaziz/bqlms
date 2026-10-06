DO $$ BEGIN
  CREATE TYPE "lms"."enrollment_source" AS ENUM('manual', 'import', 'purchase');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "lms"."enrollment_status" AS ENUM('enrolled', 'waitlisted', 'dropped', 'withdrawn', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "lms"."section_delivery" AS ENUM('in_person', 'online', 'hybrid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "lms"."section_instructor_role" AS ENUM('lead', 'co', 'ta');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "lms"."section_status" AS ENUM('draft', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "lms"."term_status" AS ENUM('planned', 'active', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lms"."courses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"credits" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lms"."enrollments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"section_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"status" "lms"."enrollment_status" NOT NULL,
	"source" "lms"."enrollment_source" DEFAULT 'manual' NOT NULL,
	"waitlist_position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lms"."holidays" (
	"id" uuid PRIMARY KEY NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holidays_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lms"."section_instructors" (
	"section_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "lms"."section_instructor_role" DEFAULT 'lead' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "section_instructors_section_id_user_id_pk" PRIMARY KEY("section_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lms"."section_schedules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"section_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"room" text,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lms"."sections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"course_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"code" text NOT NULL,
	"capacity" integer NOT NULL,
	"delivery" "lms"."section_delivery" DEFAULT 'in_person' NOT NULL,
	"status" "lms"."section_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lms"."terms" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"starts_on" timestamp with time zone NOT NULL,
	"ends_on" timestamp with time zone NOT NULL,
	"census_date" timestamp with time zone NOT NULL,
	"status" "lms"."term_status" DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lms"."enrollments" ADD CONSTRAINT "enrollments_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "lms"."sections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lms"."enrollments" ADD CONSTRAINT "enrollments_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "lms"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lms"."section_instructors" ADD CONSTRAINT "section_instructors_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "lms"."sections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lms"."section_instructors" ADD CONSTRAINT "section_instructors_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "lms"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lms"."section_schedules" ADD CONSTRAINT "section_schedules_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "lms"."sections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lms"."sections" ADD CONSTRAINT "sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "lms"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lms"."sections" ADD CONSTRAINT "sections_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "lms"."terms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_section_student_uidx" ON "lms"."enrollments" USING btree ("section_id","student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrollments_section_status_pos_idx" ON "lms"."enrollments" USING btree ("section_id","status","waitlist_position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrollments_student_status_idx" ON "lms"."enrollments" USING btree ("student_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_instructors_user_id_idx" ON "lms"."section_instructors" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_schedules_section_id_idx" ON "lms"."section_schedules" USING btree ("section_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sections_term_code_uidx" ON "lms"."sections" USING btree ("term_id","code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sections_course_id_idx" ON "lms"."sections" USING btree ("course_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sections_term_id_idx" ON "lms"."sections" USING btree ("term_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lms"."notifications" ADD CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_name_trgm_idx" ON "lms"."user" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_email_trgm_idx" ON "lms"."user" USING gin ("email" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_student_number_trgm_idx" ON "lms"."profiles" USING gin ("student_number" gin_trgm_ops);