import { eq } from "drizzle-orm";
import { type Database, db } from "@/db/client";
import type { Tx } from "@/db/tx";
import { type Settings, settingsTable } from "./schema";

export async function getSettingsRow(
  executor: Database | Tx = db,
): Promise<Settings | null> {
  const [row] = await executor
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, 1))
    .limit(1);
  return row ?? null;
}
