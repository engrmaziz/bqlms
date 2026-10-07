import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";
import { z } from "zod";
import { withTx } from "@/db/tx";
import { logger } from "@/lib/logger";
import { getStorageProvider } from "@/lib/providers/storage";
import { registerJob } from "@/modules/jobs";
import { incrementStorageReads } from "./budget";
import { fileStateMachine } from "./fsm";
import { isMimeDisallowed, PURPOSE_CONFIGS } from "./purposes";
import { filesTable } from "./schema";

export const FILE_VERIFY_JOB = "files:verify";
export const FILE_GC_JOB = "files:gc";

// 1. Verification Job
export async function runFileVerificationJob(
  fileId: string,
  jobId = "direct",
): Promise<void> {
  logger.info({ jobId, fileId }, "Running file verification job");

  await withTx(async (tx) => {
    const rows = await tx
      .select()
      .from(filesTable)
      .where(eq(filesTable.id, fileId))
      .limit(1);

    const file = rows[0];
    if (!file || file.status !== "uploaded") {
      return;
    }

    const storage = getStorageProvider();
    const config = PURPOSE_CONFIGS[file.purpose];

    // Read initial bytes to sniff file type (counts towards daily read cap)
    try {
      await incrementStorageReads(tx);
    } catch (err: unknown) {
      logger.warn(
        { err, fileId: file.id },
        "Storage read cap exceeded during verification",
      );
    }

    const rangeBuffer = await storage.getObjectRange(file.storageKey, 0, 4096);
    if (!rangeBuffer || rangeBuffer.length === 0) {
      // Object missing or empty
      await rejectFile(
        tx,
        file.id,
        file.storageKey,
        "File content is empty or unreadable.",
      );
      return;
    }

    // Sniff MIME type using file-type
    const sniffResult = await fileTypeFromBuffer(rangeBuffer);
    let detectedMime = sniffResult?.mime ?? null;

    // Security checks
    if (detectedMime) {
      // Check disallowed patterns (e.g. executables, scripts)
      if (isMimeDisallowed(detectedMime)) {
        await rejectFile(
          tx,
          file.id,
          file.storageKey,
          `Detected disallowed content type: "${detectedMime}". Executables and scripts are strictly prohibited.`,
        );
        return;
      }

      // Check if detected type is in the allowed list for this purpose
      if (!config.allowedMimeTypes.includes(detectedMime)) {
        // Allow compatible generic fallback (e.g. application/octet-stream for zip/scorm)
        const isZipMatch =
          (detectedMime === "application/zip" ||
            detectedMime === "application/x-zip-compressed") &&
          config.allowedMimeTypes.includes("application/zip");

        if (!isZipMatch) {
          await rejectFile(
            tx,
            file.id,
            file.storageKey,
            `Detected file type "${detectedMime}" does not match allowed formats for purpose "${file.purpose}".`,
          );
          return;
        }
      }

      // Mismatch check between declared and detected MIME
      // e.g. Executable renamed to .pdf, or image renamed to .docx
      const declared = file.declaredMime.toLowerCase();
      if (
        declared === "application/pdf" &&
        detectedMime !== "application/pdf"
      ) {
        await rejectFile(
          tx,
          file.id,
          file.storageKey,
          `File declared as PDF but detected as "${detectedMime}".`,
        );
        return;
      }

      if (declared.startsWith("image/") && !detectedMime.startsWith("image/")) {
        await rejectFile(
          tx,
          file.id,
          file.storageKey,
          `File declared as image but detected as "${detectedMime}".`,
        );
        return;
      }
    } else {
      // fileTypeFromBuffer returns undefined for plain text and CSV
      const declared = file.declaredMime.toLowerCase();
      const isDeclaredText =
        declared === "text/plain" || declared === "text/csv";

      if (!isDeclaredText) {
        // A binary format (PDF, DOCX, ZIP, image) that failed sniffing
        await rejectFile(
          tx,
          file.id,
          file.storageKey,
          `Corrupted file or format unrecognized for declared type "${file.declaredMime}".`,
        );
        return;
      }

      // Validate text content does not contain binary null bytes or HTML/scripts
      const textSample = rangeBuffer.toString("utf8");
      if (rangeBuffer.includes(0)) {
        await rejectFile(
          tx,
          file.id,
          file.storageKey,
          "Text file contains illegal binary null bytes.",
        );
        return;
      }

      if (/<script\b|<html\b|<!doctype|<svg\b|<\?xml/i.test(textSample)) {
        await rejectFile(
          tx,
          file.id,
          file.storageKey,
          "File contains disallowed HTML/XML/Script tags.",
        );
        return;
      }

      detectedMime = declared;
    }

    // Verification succeeded!
    const nextStatus = fileStateMachine.transition(file.status, "VERIFY");
    await tx
      .update(filesTable)
      .set({
        status: nextStatus,
        detectedMime: detectedMime ?? file.declaredMime,
        updatedAt: new Date(),
      })
      .where(eq(filesTable.id, file.id));

    logger.info(
      { fileId: file.id, detectedMime },
      "File verified successfully",
    );
  });
}

registerJob(FILE_VERIFY_JOB, {
  schema: z.object({
    fileId: z.string().uuid(),
  }),
  handler: async (payload, ctx) => {
    await runFileVerificationJob(payload.fileId, ctx.jobId);
  },
  maxAttempts: 3,
});

async function rejectFile(
  tx: Parameters<Parameters<typeof withTx>[0]>[0],
  fileId: string,
  storageKey: string,
  reason: string,
): Promise<void> {
  logger.warn({ fileId, storageKey, reason }, "File verification rejected");

  const storage = getStorageProvider();
  // Delete the rejected object from storage immediately to prevent malware hosting
  await storage.deleteObject(storageKey);

  await tx
    .update(filesTable)
    .set({
      status: "rejected",
      rejectionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(filesTable.id, fileId));
}

// 2. Garbage Collection Job (GC)
export async function runFileGcJob(jobId = "direct"): Promise<void> {
  logger.info({ jobId }, "Running files GC retention job");

  await withTx(async (tx) => {
    const storage = getStorageProvider();

    // (A) Delete pending files older than 24 hours
    const abandonedPending = await tx
      .select()
      .from(filesTable)
      .where(
        and(
          eq(filesTable.status, "pending"),
          lt(filesTable.createdAt, sql`now() - interval '24 hours'`),
          isNull(filesTable.deletedAt),
        ),
      );

    for (const item of abandonedPending) {
      await storage.deleteObject(item.storageKey);
      await tx
        .update(filesTable)
        .set({
          status: "deleted",
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(filesTable.id, item.id));
    }

    // (B) Hard delete soft-deleted files older than 30 days to free DB and storage budget
    const expiredDeleted = await tx
      .select()
      .from(filesTable)
      .where(
        and(
          eq(filesTable.status, "deleted"),
          lt(filesTable.deletedAt, sql`now() - interval '30 days'`),
        ),
      );

    for (const item of expiredDeleted) {
      await storage.deleteObject(item.storageKey);
      await tx.delete(filesTable).where(eq(filesTable.id, item.id));
    }
  });
}

registerJob(FILE_GC_JOB, {
  schema: z.object({}).passthrough(),
  handler: async (_payload, ctx) => {
    await runFileGcJob(ctx.jobId);
  },
  maxAttempts: 3,
});
