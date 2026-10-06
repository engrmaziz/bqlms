DO $$ BEGIN
  ALTER TABLE "lms"."password_reset_links" ADD CONSTRAINT "password_reset_links_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "lms"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;