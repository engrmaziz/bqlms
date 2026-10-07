import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { defineRoute } from "@/lib/api/define-route";
import { AppError } from "@/lib/errors";
import { getStorageProvider } from "@/lib/providers/storage";
import {
  canDownloadFile,
  filesTable,
  incrementStorageReads,
} from "@/modules/files";

export const GET = defineRoute({
  permission: "upload:read",
  input: z.object({
    fileId: z.string().uuid(),
  }),
  handler: async (tx, actor, input) => {
    if (!actor) {
      throw new AppError({
        code: "UNAUTHENTICATED",
        message: "Authentication required to download files.",
      });
    }

    const rows = await tx
      .select()
      .from(filesTable)
      .where(and(eq(filesTable.id, input.fileId), isNull(filesTable.deletedAt)))
      .limit(1);

    const file = rows[0];
    if (!file) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "File not found.",
      });
    }

    // Authorize download via file policy
    const isAllowed = canDownloadFile(actor, file);
    if (!isAllowed) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "You do not have permission to download this file.",
      });
    }

    // Increment storage read budget
    await incrementStorageReads(tx);

    // Generate presigned GET URL (TTL 60s)
    const storage = getStorageProvider();
    const disposition =
      file.declaredMime === "application/pdf" ? "inline" : "attachment";

    const presignedUrl = await storage.getPresignedDownloadUrl({
      key: file.storageKey,
      mime: file.detectedMime ?? file.declaredMime,
      disposition,
      expiresInSeconds: 60,
    });

    return NextResponse.redirect(presignedUrl, 302);
  },
});
