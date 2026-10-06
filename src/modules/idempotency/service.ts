import { createHash } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import type { Tx } from "@/db/tx";
import { idempotencyKeysTable } from "./schema";

const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export function computeRequestHash(data: unknown): string {
  const normalized =
    typeof data === "string" ? data : JSON.stringify(data ?? "");
  return createHash("sha256").update(normalized).digest("hex");
}

export type IdempotencyCheckResult =
  | { state: "replay"; response: unknown }
  | { state: "conflict" }
  | { state: "new" };

export async function checkIdempotency(
  key: string,
  actorId: string,
  requestHash: string,
): Promise<IdempotencyCheckResult> {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(idempotencyKeysTable)
    .where(
      and(
        eq(idempotencyKeysTable.key, key),
        eq(idempotencyKeysTable.actorId, actorId),
        gt(idempotencyKeysTable.expiresAt, now),
      ),
    );

  if (!existing) {
    return { state: "new" };
  }

  if (existing.requestHash === requestHash) {
    return { state: "replay", response: existing.response };
  }

  return { state: "conflict" };
}

export async function saveIdempotencyRecord(
  txOrDb: Tx | typeof db,
  params: {
    key: string;
    actorId: string;
    requestHash: string;
    response: unknown;
    ttlSeconds?: number;
  },
): Promise<void> {
  const ttlSeconds = params.ttlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await txOrDb
    .insert(idempotencyKeysTable)
    .values({
      key: params.key,
      actorId: params.actorId,
      requestHash: params.requestHash,
      response: params.response,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [idempotencyKeysTable.key, idempotencyKeysTable.actorId],
      set: {
        requestHash: params.requestHash,
        response: params.response,
        expiresAt,
      },
    });
}
