import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import type { Tx } from "@/db/tx";
import type { Actor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { getStorageProvider } from "@/lib/providers/storage";
import { enqueue } from "@/modules/jobs";
import { checkStorageBudget } from "./budget";
import { fileStateMachine } from "./fsm";
import { canDeleteFile, canUploadFile } from "./policy";
import {
  buildStorageKey,
  getFileExtension,
  isExtensionDisallowed,
  isMimeDisallowed,
  PURPOSE_CONFIGS,
  sanitizeFilename,
} from "./purposes";
import {
  type FileDelivery,
  type FilePurpose,
  type FileRecord,
  filesTable,
} from "./schema";

export interface RequestUploadInput {
  purpose: FilePurpose;
  name: string;
  size: number;
  mime: string;
  delivery?: FileDelivery | undefined;
}

export interface RequestUploadResult {
  file: FileRecord;
  uploadUrl: string;
}

export async function requestUpload(
  tx: Tx,
  actor: Actor,
  input: RequestUploadInput,
): Promise<RequestUploadResult> {
  const config = PURPOSE_CONFIGS[input.purpose];
  if (!config) {
    throw new AppError({
      code: "VALIDATION",
      message: `Invalid file purpose: "${input.purpose}"`,
    });
  }

  const delivery: FileDelivery = input.delivery ?? config.delivery;
  canUploadFile(actor, input.purpose, delivery);

  // 1. Refuse oversize requests before upload
  if (input.size > config.maxSizeBytes) {
    throw new AppError({
      code: "VALIDATION",
      message: `File size ${(input.size / 1024 / 1024).toFixed(2)} MB exceeds maximum allowed cap of ${(config.maxSizeBytes / 1024 / 1024).toFixed(2)} MB for "${input.purpose}".`,
    });
  }

  if (input.size <= 0) {
    throw new AppError({
      code: "VALIDATION",
      message: "File size must be greater than 0 bytes.",
    });
  }

  // 2. MIME allowlist and blacklist validation
  const normalizedMime = input.mime.toLowerCase().trim();
  if (isMimeDisallowed(normalizedMime)) {
    throw new AppError({
      code: "VALIDATION",
      message: `MIME type "${normalizedMime}" is strictly disallowed for security reasons.`,
    });
  }

  if (!config.allowedMimeTypes.includes(normalizedMime)) {
    throw new AppError({
      code: "VALIDATION",
      message: `MIME type "${normalizedMime}" is not allowed for purpose "${input.purpose}". Allowed types: ${config.allowedMimeTypes.join(", ")}`,
    });
  }

  // 3. Extension allowlist and blacklist validation
  const ext = getFileExtension(input.name);
  if (isExtensionDisallowed(ext)) {
    throw new AppError({
      code: "VALIDATION",
      message: `File extension ".${ext}" is strictly disallowed for security reasons.`,
    });
  }

  if (!config.allowedExtensions.includes(ext)) {
    throw new AppError({
      code: "VALIDATION",
      message: `File extension ".${ext}" is not allowed for purpose "${input.purpose}". Allowed extensions: ${config.allowedExtensions.join(", ")}`,
    });
  }

  // 4. Budget check (Storage byte budget & user daily upload budget)
  await checkStorageBudget(tx, input.size, actor.userId);

  // 5. Generate metadata & storage key
  const fileId = uuidv7();
  const cleanName = sanitizeFilename(input.name);
  const storageKey = buildStorageKey(input.purpose, fileId, cleanName);

  // 128-bit random public key for CDN delivery
  const publicKey =
    delivery === "cdn" ? crypto.randomBytes(16).toString("hex") : null;

  // 6. Insert pending record
  const inserted = await tx
    .insert(filesTable)
    .values({
      id: fileId,
      ownerId: actor.userId,
      purpose: input.purpose,
      delivery,
      publicKey,
      status: "pending",
      declaredMime: normalizedMime,
      sizeBytes: input.size,
      storageKey,
    })
    .returning();

  const file = inserted[0];
  if (!file) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to create file record.",
    });
  }

  // 7. Request presigned upload URL (TTL 5 minutes)
  const storage = getStorageProvider();
  const uploadUrl = await storage.getPresignedUploadUrl({
    key: storageKey,
    mime: normalizedMime,
    sizeBytes: input.size,
    expiresInSeconds: 300,
  });

  return { file, uploadUrl };
}

export async function completeUpload(
  tx: Tx,
  actor: Actor,
  fileId: string,
): Promise<FileRecord> {
  const rows = await tx
    .select()
    .from(filesTable)
    .where(and(eq(filesTable.id, fileId), isNull(filesTable.deletedAt)))
    .limit(1);

  const file = rows[0];
  if (!file) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "File not found.",
    });
  }

  if (file.status !== "pending") {
    throw new AppError({
      code: "PRECONDITION_FAILED",
      message: `File is in "${file.status}" status, expected "pending".`,
    });
  }

  // Only owner or admin may complete upload
  const isOwner = file.ownerId === actor.userId;
  const isAdmin =
    actor.roles.includes("super_admin") || actor.roles.includes("admin");
  if (!isOwner && !isAdmin) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You can only complete your own uploads.",
    });
  }

  // Verify object exists in storage
  const storage = getStorageProvider();
  const head = await storage.headObject(file.storageKey);
  if (!head) {
    throw new AppError({
      code: "NOT_FOUND",
      message:
        "The file was not found in storage. Please upload the file before completing.",
    });
  }

  const nextStatus = fileStateMachine.transition(
    file.status,
    "COMPLETE_UPLOAD",
  );

  const updatedRows = await tx
    .update(filesTable)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(filesTable.id, fileId))
    .returning();

  const updatedFile = updatedRows[0];
  if (!updatedFile) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to update file status.",
    });
  }

  // Enqueue verification job in the same transaction
  await enqueue(
    tx,
    "files:verify",
    { fileId },
    {
      dedupeKey: `files:verify:${fileId}`,
      maxAttempts: 3,
    },
  );

  return updatedFile;
}

export async function deleteFile(
  tx: Tx,
  actor: Actor,
  fileId: string,
): Promise<FileRecord> {
  const rows = await tx
    .select()
    .from(filesTable)
    .where(and(eq(filesTable.id, fileId), isNull(filesTable.deletedAt)))
    .limit(1);

  const file = rows[0];
  if (!file) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "File not found.",
    });
  }

  if (!canDeleteFile(actor, file)) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to delete this file.",
    });
  }

  const nextStatus = fileStateMachine.transition(file.status, "DELETE");

  const updatedRows = await tx
    .update(filesTable)
    .set({
      status: nextStatus,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(filesTable.id, fileId))
    .returning();

  const updatedFile = updatedRows[0];
  if (!updatedFile) {
    throw new AppError({
      code: "INTERNAL",
      message: "Failed to mark file as deleted.",
    });
  }

  return updatedFile;
}

export async function hardDeleteFile(tx: Tx, fileId: string): Promise<void> {
  const rows = await tx
    .select()
    .from(filesTable)
    .where(eq(filesTable.id, fileId))
    .limit(1);

  const file = rows[0];
  if (!file) return;

  const storage = getStorageProvider();
  await storage.deleteObject(file.storageKey);

  await tx.delete(filesTable).where(eq(filesTable.id, fileId));
}
