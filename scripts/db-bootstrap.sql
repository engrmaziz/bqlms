-- Bootstrap script for single-college LMS database
-- Run with DATABASE_URL_SESSION (session-mode pooler or direct connection)

-- 1. Create dedicated application schema
CREATE SCHEMA IF NOT EXISTS lms;

-- 2. Create required extensions in public or default schema
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- 3. Guarded DO block: revoke all privileges on schema lms from anon and authenticated roles if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA lms FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA lms FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA lms FROM anon;
    REVOKE ALL ON ALL ROUTINES IN SCHEMA lms FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA lms REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA lms REVOKE ALL ON SEQUENCES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA lms REVOKE ALL ON ROUTINES FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA lms FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA lms FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA lms FROM authenticated;
    REVOKE ALL ON ALL ROUTINES IN SCHEMA lms FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA lms REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA lms REVOKE ALL ON SEQUENCES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA lms REVOKE ALL ON ROUTINES FROM authenticated;
  END IF;
END $$;
