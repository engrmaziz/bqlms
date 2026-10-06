import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env" });

export interface TableSizeInfo {
  schemaName: string;
  tableName: string;
  approxRowCount: number;
  totalSize: string;
  totalBytes: number;
}

export interface DatabaseSizeReport {
  databaseName: string;
  totalSize: string;
  totalBytes: number;
  tables: TableSizeInfo[];
}

export async function getDatabaseSizeReport(
  client?: postgres.Sql,
): Promise<DatabaseSizeReport> {
  const ownClient = !client;
  const sql =
    client ??
    postgres(
      process.env.DATABASE_URL_SESSION || process.env.DATABASE_URL || "",
      { max: 1 },
    );

  try {
    const [dbSizeRow] = await sql`
      SELECT
        current_database() as database_name,
        pg_size_pretty(pg_database_size(current_database())) as total_size,
        pg_database_size(current_database())::bigint as total_bytes;
    `;

    const tableRows = await sql`
      SELECT
        schemaname as schema_name,
        relname as table_name,
        n_live_tup::bigint as approx_row_count,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size,
        pg_total_relation_size(relid)::bigint as total_bytes
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 15;
    `;

    return {
      databaseName: String(dbSizeRow?.database_name ?? "unknown"),
      totalSize: String(dbSizeRow?.total_size ?? "0 B"),
      totalBytes: Number(dbSizeRow?.total_bytes ?? 0),
      tables: tableRows.map((r) => ({
        schemaName: String(r.schema_name),
        tableName: String(r.table_name),
        approxRowCount: Number(r.approx_row_count ?? 0),
        totalSize: String(r.total_size),
        totalBytes: Number(r.total_bytes ?? 0),
      })),
    };
  } finally {
    if (ownClient) {
      await sql.end();
    }
  }
}

async function run() {
  const report = await getDatabaseSizeReport();
  console.log(`\n=== Database Size Report: ${report.databaseName} ===`);
  console.log(
    `Total Database Size: ${report.totalSize} (${report.totalBytes.toLocaleString()} bytes)\n`,
  );
  console.log("Top 15 Largest Tables:");
  console.log(
    "Schema".padEnd(12) +
      "Table".padEnd(25) +
      "Approx Rows".padEnd(15) +
      "Size",
  );
  console.log("-".repeat(60));
  for (const table of report.tables) {
    console.log(
      table.schemaName.padEnd(12) +
        table.tableName.padEnd(25) +
        table.approxRowCount.toLocaleString().padEnd(15) +
        table.totalSize,
    );
  }
  console.log("");
}

if (process.argv[1]?.endsWith("db-size.ts")) {
  run().catch((err) => {
    console.error("Failed to fetch database size report:", err);
    process.exit(1);
  });
}
