import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import type { Tx } from "@/db/tx";
import { type AuditLog, auditLogsTable } from "./schema";

export async function insertAuditLogRow(
  tx: Tx,
  data: typeof auditLogsTable.$inferInsert,
): Promise<AuditLog> {
  const [created] = await tx.insert(auditLogsTable).values(data).returning();
  if (!created) {
    throw new Error("Failed to insert audit log row");
  }
  return created;
}

export interface ListAuditLogsParams {
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export async function findAuditLogs(
  params: ListAuditLogsParams,
): Promise<AuditLog[]> {
  const conditions = [];

  if (params.resourceType) {
    conditions.push(eq(auditLogsTable.resourceType, params.resourceType));
  }
  if (params.resourceId) {
    conditions.push(eq(auditLogsTable.resourceId, params.resourceId));
  }
  if (params.actorId) {
    conditions.push(eq(auditLogsTable.actorId, params.actorId));
  }
  if (params.since) {
    conditions.push(gte(auditLogsTable.at, params.since));
  }
  if (params.until) {
    conditions.push(lte(auditLogsTable.at, params.until));
  }

  const query = db
    .select()
    .from(auditLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogsTable.at))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);

  return query;
}
