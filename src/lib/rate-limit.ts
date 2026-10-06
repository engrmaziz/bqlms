import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  type RateLimitsRecord,
  rateLimitsTable,
} from "@/modules/rate-limit/schema";

export { rateLimitsTable, type RateLimitsRecord };

export const RATE_LIMIT_BUCKETS = [
  "auth",
  "write",
  "upload",
  "ai",
  "message",
] as const;

export type RateLimitBucket = (typeof RATE_LIMIT_BUCKETS)[number];

export interface BucketDefaults {
  limit: number;
  windowSeconds: number;
}

export const BUCKET_DEFAULTS: Record<RateLimitBucket, BucketDefaults> = {
  auth: { limit: 10, windowSeconds: 60 },
  write: { limit: 60, windowSeconds: 60 },
  upload: { limit: 10, windowSeconds: 60 },
  ai: { limit: 10, windowSeconds: 60 },
  message: { limit: 30, windowSeconds: 60 },
};

export interface CheckRateLimitParams {
  bucket: RateLimitBucket;
  identifier: string;
  limit?: number | undefined;
  windowSeconds?: number | undefined;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

/**
 * Atomic fixed-window rate limiter in Postgres.
 * Performs a single atomic upsert returning the new count.
 */
export async function checkRateLimit(
  params: CheckRateLimitParams,
): Promise<RateLimitResult> {
  const defaults = BUCKET_DEFAULTS[params.bucket];
  const limit = params.limit ?? defaults.limit;
  const windowSeconds = params.windowSeconds ?? defaults.windowSeconds;

  const now = Date.now();
  const windowDurationMs = windowSeconds * 1000;
  const windowStartMs = Math.floor(now / windowDurationMs) * windowDurationMs;
  const windowStart = new Date(windowStartMs);
  const compositeKey = `${params.bucket}:${params.identifier}`;

  const rows = await db
    .insert(rateLimitsTable)
    .values({
      key: compositeKey,
      windowStart,
      count: 1,
    })
    .onConflictDoUpdate({
      target: [rateLimitsTable.key, rateLimitsTable.windowStart],
      set: {
        count: sql`${rateLimitsTable.count} + 1`,
      },
    })
    .returning({ count: rateLimitsTable.count });

  const currentCount = rows[0]?.count ?? 1;
  const allowed = currentCount <= limit;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((windowStartMs + windowDurationMs - now) / 1000),
  );

  return {
    allowed,
    count: currentCount,
    limit,
    retryAfterSeconds,
  };
}
