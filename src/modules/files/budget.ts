import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Tx } from "@/db/tx";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { filesTable, storageReadsTable } from "./schema";

let budgetBytesOverride: number | null = null;
let dailyReadCapOverride: number | null = null;

export function setStorageBudgetOverride(bytes: number | null): void {
  budgetBytesOverride = bytes;
}

export function setStorageReadCapOverride(cap: number | null): void {
  dailyReadCapOverride = cap;
}

export function getStorageBudgetLimit(): number {
  return budgetBytesOverride ?? env.STORAGE_BUDGET_BYTES;
}

export function getStorageDailyReadCap(): number {
  return dailyReadCapOverride ?? env.STORAGE_DAILY_READ_CAP;
}

export const USER_DAILY_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024; // 100 MB per user per day

export async function getStorageUsage(
  customTx?: Tx,
): Promise<{ liveBytes: number; fileCount: number }> {
  const runner = customTx ?? db;
  // Live bytes are non-deleted files in pending, uploaded, or verified status
  const rows = await runner
    .select({
      totalBytes: sql<string>`coalesce(sum(${filesTable.sizeBytes}), 0)`,
      count: sql<string>`count(*)`,
    })
    .from(filesTable)
    .where(
      and(
        inArray(filesTable.status, ["pending", "uploaded", "verified"]),
        isNull(filesTable.deletedAt),
      ),
    );

  const row = rows[0];
  return {
    liveBytes: Number(row?.totalBytes ?? 0),
    fileCount: Number(row?.count ?? 0),
  };
}

export async function checkStorageBudget(
  tx: Tx,
  additionalBytes: number,
  ownerId: string,
): Promise<void> {
  const limit = getStorageBudgetLimit();
  const { liveBytes } = await getStorageUsage(tx);

  if (liveBytes + additionalBytes > limit) {
    throw new AppError({
      code: "QUOTA_EXCEEDED",
      message: `Storage budget exceeded. Current live usage is ${(liveBytes / 1024 / 1024).toFixed(2)} MB, requested +${(additionalBytes / 1024 / 1024).toFixed(2)} MB exceeds limit of ${(limit / 1024 / 1024).toFixed(2)} MB.`,
    });
  }

  // Check per-user daily upload limit (uploaded in last 24h)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const userRecentUploads = await tx
    .select({
      totalBytes: sql<string>`coalesce(sum(${filesTable.sizeBytes}), 0)`,
    })
    .from(filesTable)
    .where(
      and(
        eq(filesTable.ownerId, ownerId),
        gte(filesTable.createdAt, twentyFourHoursAgo),
        isNull(filesTable.deletedAt),
      ),
    );

  const userBytes = Number(userRecentUploads[0]?.totalBytes ?? 0);
  if (userBytes + additionalBytes > USER_DAILY_UPLOAD_LIMIT_BYTES) {
    throw new AppError({
      code: "QUOTA_EXCEEDED",
      message: `User daily upload limit exceeded. You have uploaded ${(userBytes / 1024 / 1024).toFixed(2)} MB in the last 24 hours.`,
    });
  }
}

export function getTodayUtcKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function incrementStorageReads(customTx?: Tx): Promise<number> {
  const runner = customTx ?? db;
  const day = getTodayUtcKey();
  const cap = getStorageDailyReadCap();

  // Atomically increment or insert today's read count
  const rows = await runner
    .insert(storageReadsTable)
    .values({
      day,
      count: 1,
    })
    .onConflictDoUpdate({
      target: storageReadsTable.day,
      set: {
        count: sql`${storageReadsTable.count} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({
      count: storageReadsTable.count,
    });

  const updatedCount = rows[0]?.count ?? 1;

  if (updatedCount > cap) {
    throw new AppError({
      code: "QUOTA_EXCEEDED",
      message: "Storage daily read cap exceeded. Please try again tomorrow.",
    });
  }

  return updatedCount;
}

export async function getStorageReadMetrics(customTx?: Tx): Promise<{
  day: string;
  count: number;
  cap: number;
}> {
  const runner = customTx ?? db;
  const day = getTodayUtcKey();
  const cap = getStorageDailyReadCap();

  const rows = await runner
    .select({ count: storageReadsTable.count })
    .from(storageReadsTable)
    .where(eq(storageReadsTable.day, day))
    .limit(1);

  return {
    day,
    count: rows[0]?.count ?? 0,
    cap,
  };
}
