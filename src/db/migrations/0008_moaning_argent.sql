CREATE TYPE "lms"."drip_target_type" AS ENUM('module', 'lesson');--> statement-breakpoint
CREATE TYPE "lms"."lesson_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "lms"."lesson_type" AS ENUM('rich_text', 'video', 'file', 'embed', 'scorm', 'assessment_ref', 'live_ref');--> statement-breakpoint
CREATE TYPE "lms"."module_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "lms"."progress_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "lms"."drip_overrides" (
	"id" uuid PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"target_id" uuid NOT NULL,
	"target_type" "lms"."drip_target_type" NOT NULL,
	"unlocked_at" timestamp with time zone NOT NULL,
	"reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms"."lesson_progress" (
	"id" uuid PRIMARY KEY NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"status" "lms"."progress_status" DEFAULT 'not_started' NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"last_position_s" integer DEFAULT 0 NOT NULL,
	"watched" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms"."lessons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"module_id" uuid NOT NULL,
	"type" "lms"."lesson_type" NOT NULL,
	"title" text NOT NULL,
	"position" text NOT NULL,
	"body" jsonb,
	"file_id" uuid,
	"video" jsonb,
	"est_minutes" integer DEFAULT 5 NOT NULL,
	"status" "lms"."lesson_status" DEFAULT 'draft' NOT NULL,
	"drip_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms"."modules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"section_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" text NOT NULL,
	"status" "lms"."module_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lms"."section_completions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "section_completions_enrollment_id_unique" UNIQUE("enrollment_id")
);
--> statement-breakpoint
CREATE TABLE "lms"."syllabus_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"section_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lms"."drip_overrides" ADD CONSTRAINT "drip_overrides_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "lms"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms"."drip_overrides" ADD CONSTRAINT "drip_overrides_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "lms"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms"."lesson_progress" ADD CONSTRAINT "lesson_progress_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "lms"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms"."lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "lms"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms"."lessons" ADD CONSTRAINT "lessons_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "lms"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms"."lessons" ADD CONSTRAINT "lessons_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "lms"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms"."modules" ADD CONSTRAINT "modules_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "lms"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms"."section_completions" ADD CONSTRAINT "section_completions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "lms"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms"."syllabus_versions" ADD CONSTRAINT "syllabus_versions_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "lms"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lms"."syllabus_versions" ADD CONSTRAINT "syllabus_versions_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "lms"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drip_overrides_student_target_uidx" ON "lms"."drip_overrides" USING btree ("student_id","target_id");--> statement-breakpoint
CREATE INDEX "drip_overrides_student_id_idx" ON "lms"."drip_overrides" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_progress_enrollment_lesson_uidx" ON "lms"."lesson_progress" USING btree ("enrollment_id","lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_progress_enrollment_status_idx" ON "lms"."lesson_progress" USING btree ("enrollment_id","status");--> statement-breakpoint
CREATE INDEX "lessons_module_id_idx" ON "lms"."lessons" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "lessons_position_idx" ON "lms"."lessons" USING btree ("position");--> statement-breakpoint
CREATE INDEX "modules_section_id_idx" ON "lms"."modules" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "modules_position_idx" ON "lms"."modules" USING btree ("position");--> statement-breakpoint
CREATE UNIQUE INDEX "section_completions_enrollment_uidx" ON "lms"."section_completions" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "syllabus_versions_section_version_uidx" ON "lms"."syllabus_versions" USING btree ("section_id","version");--> statement-breakpoint
CREATE INDEX "syllabus_versions_section_id_idx" ON "lms"."syllabus_versions" USING btree ("section_id");