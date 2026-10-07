import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { defineRoute } from "@/lib/api/define-route";
import { AppError } from "@/lib/errors";
import { getStorageProvider } from "@/lib/providers/storage";
import { filesTable, incrementStorageReads } from "@/modules/files";

export const GET = defineRoute({
  public: true, // Capability URL with random 128-bit public_key
  input: z.object({
    fileId: z.string().uuid(),
    key: z.string().min(16),
  }),
  handler: async (tx, _actor, input) => {
    const rows = await tx
      .select()
      .from(filesTable)
      .where(
        and(
          eq(filesTable.id, input.fileId),
          eq(filesTable.publicKey, input.key),
          eq(filesTable.delivery, "cdn"),
          isNull(filesTable.deletedAt),
        ),
      )
      .limit(1);

    const file = rows[0];
    if (!file || file.status !== "verified") {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Media not found or invalid capability key.",
      });
    }

    if (file.sizeBytes > 4 * 1024 * 1024) {
      throw new AppError({
        code: "VALIDATION",
        message: "Media object exceeds 4 MB streaming limit.",
      });
    }

    // Increment storage read budget
    await incrementStorageReads(tx);

    const storage = getStorageProvider();
    const object = await storage.getObject(file.storageKey);
    if (!object) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Media content not found in storage.",
      });
    }

    const mime = file.detectedMime ?? file.declaredMime;

    return new Response(new Uint8Array(object.data), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(file.sizeBytes),
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  },
});
