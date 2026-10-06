import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env" });

const connectionString =
  process.env.DATABASE_URL_SESSION || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("Missing DATABASE_URL_SESSION or DATABASE_URL");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function checkSchema() {
  console.log("Checking database schema isolation and security...");

  // 1. Check if any application tables exist in 'public' schema
  const knownAppTables = ["settings"];
  const publicTables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name = ANY(${knownAppTables});
  `;

  if (publicTables.length > 0) {
    console.error(
      `❌ Security Violation: Application table(s) found in 'public' schema: ${publicTables.map((t) => t.table_name).join(", ")}. All LMS tables must be in schema 'lms'.`,
    );
    await sql.end();
    process.exit(1);
  }

  // 2. Check if anon or authenticated roles hold any privilege on schema 'lms'
  const leakedPrivileges = await sql`
    SELECT r.rolname, p.privilege_type
    FROM pg_roles r
    CROSS JOIN LATERAL (
      SELECT 'USAGE' as privilege_type WHERE has_schema_privilege(r.rolname, 'lms', 'USAGE')
      UNION
      SELECT 'CREATE' as privilege_type WHERE has_schema_privilege(r.rolname, 'lms', 'CREATE')
    ) p
    WHERE r.rolname IN ('anon', 'authenticated');
  `;

  if (leakedPrivileges.length > 0) {
    console.error(
      "❌ Security Violation: Roles 'anon' or 'authenticated' hold privileges on schema 'lms':",
      leakedPrivileges,
    );
    await sql.end();
    process.exit(1);
  }

  // Also check table-level privileges in 'lms'
  const leakedTablePrivileges = await sql`
    SELECT grantee, table_name, privilege_type
    FROM information_schema.table_privileges
    WHERE table_schema = 'lms'
      AND grantee IN ('anon', 'authenticated');
  `;

  if (leakedTablePrivileges.length > 0) {
    console.error(
      "❌ Security Violation: Roles 'anon' or 'authenticated' hold table privileges in schema 'lms':",
      leakedTablePrivileges,
    );
    await sql.end();
    process.exit(1);
  }

  console.log(
    "✓ Schema isolation verified: No application tables in public, schema lms is closed.",
  );
  await sql.end();
}

checkSchema().catch(async (err) => {
  console.error("Check schema failed with error:", err);
  await sql.end();
  process.exit(1);
});
