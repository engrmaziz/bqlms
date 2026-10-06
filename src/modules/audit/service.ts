import type { Tx } from "@/db/tx";
import { insertAuditLogRow } from "./queries";
import type { AuditLog } from "./schema";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "hash",
  "salt",
  "backupcodes",
  "backup_codes",
  "credentials",
  "tokenhash",
  "token_hash",
]);

const MAX_JSON_BYTES = 4096; // 4 KB hard cap

/**
 * Sanitizes JSON payload: strips sensitive credential keys and bounds output to 4 KB.
 */
export function sanitizeAuditPayload(data: unknown): unknown {
  if (data === undefined || data === null) {
    return null;
  }

  function clean(val: unknown): unknown {
    if (val === null || val === undefined) {
      return val;
    }
    if (typeof val === "object") {
      if (Array.isArray(val)) {
        return val.map((item) => clean(item));
      }
      const cleanedObj: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(val)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          cleanedObj[key] = "[REDACTED]";
        } else {
          cleanedObj[key] = clean(v);
        }
      }
      return cleanedObj;
    }
    return val;
  }

  const cleaned = clean(data);
  const serialized = JSON.stringify(cleaned);

  if (Buffer.byteLength(serialized, "utf8") <= MAX_JSON_BYTES) {
    return cleaned;
  }

  // If size exceeds 4 KB, summarize/truncate
  return {
    _truncated: true,
    _byteLength: Buffer.byteLength(serialized, "utf8"),
    _summary: `${serialized.slice(0, 3900)}...`,
  };
}

export interface RecordAuditParams {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | undefined;
  requestId: string;
}

export async function recordAuditLog(
  tx: Tx,
  params: RecordAuditParams,
): Promise<AuditLog> {
  const sanitizedBefore = sanitizeAuditPayload(params.before);
  const sanitizedAfter = sanitizeAuditPayload(params.after);

  return insertAuditLogRow(tx, {
    actorId: params.actorId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    before: sanitizedBefore,
    after: sanitizedAfter,
    ip: params.ip,
    requestId: params.requestId,
  });
}
