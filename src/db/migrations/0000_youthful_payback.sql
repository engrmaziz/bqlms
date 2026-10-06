CREATE SCHEMA IF NOT EXISTS "lms";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lms"."settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"college_name" text DEFAULT 'Open College' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"branding" jsonb DEFAULT '{"logoUrl":null,"primaryColor":"#4f46e5","accentColor":"#06b6d4","institutionMotto":"Excellence in Education","faviconUrl":null}'::jsonb NOT NULL,
	"policies" jsonb DEFAULT '{"allowSelfRegistration":false,"maxStudentsPerCourse":80,"enforceMfa":false,"sessionTimeoutMinutes":60}'::jsonb NOT NULL,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "settings_single_row_check" CHECK ("lms"."settings"."id" = 1)
);
