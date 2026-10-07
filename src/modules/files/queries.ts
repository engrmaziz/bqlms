import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import type { Tx } from "@/db/tx";
import {
  getStorageDailyReadCap,
  getStorageReadMetrics,
  getStorageUsage,
} from "./budget";
import { type FileRecord, filesTable } from "./schema";

export async function getFileById(
  fileId: string,
  tx?: Tx,
  options?: { includeDeleted?: boolean },
): Promise<FileRecord | null> {
  const runner = tx ?? db;
  const conditions = [eq(filesTable.id, fileId)];
  if (!options?.includeDeleted) {
    conditions.push(isNull(filesTable.deletedAt));
  }

  const rows = await runner
    .select()
    .from(filesTable)
    .where(and(...conditions))
    .limit(1);

  return rows[0] ?? null;
}

export async function getFilesByOwner(
  ownerId: string,
  tx?: Tx,
): Promise<FileRecord[]> {
  const runner = tx ?? db;
  return runner
    .select()
    .from(filesTable)
    .where(and(eq(filesTable.ownerId, ownerId), isNull(filesTable.deletedAt)))
    .orderBy(desc(filesTable.createdAt));
}

export async function getStorageMetrics(tx?: Tx): Promise<{
  liveBytes: number;
  fileCount: number;
  todayReads: number;
  dailyReadCap: number;
}> {
  const usage = await getStorageUsage(tx);
  const readMetrics = await getStorageReadMetrics(tx);

  return {
    liveBytes: usage.liveBytes,
    fileCount: usage.fileCount,
    todayReads: readMetrics.count,
    dailyReadCap: getStorageDailyReadCap(),
  };
}
