import { bigint, index, integer, text, timestamp } from "drizzle-orm/pg-core";
import { id, lmsSchema } from "@/db/schema/_shared";
import { userTable } from "@/modules/identity/schema";

export const filePurposeEnum = lmsSchema.enum("file_purpose", [
  "lesson_document",
  "lesson_image",
  "avatar",
  "submission",
  "payment_proof",
  "scorm_package",
]);
export type FilePurpose = (typeof filePurposeEnum.enumValues)[number];

export const fileDeliveryEnum = lmsSchema.enum("file_delivery", [
  "signed",
  "cdn",
]);
export type FileDelivery = (typeof fileDeliveryEnum.enumValues)[number];

export const fileStatusEnum = lmsSchema.enum("file_status", [
  "pending",
  "uploaded",
  "verified",
  "rejected",
  "deleted",
]);
export type FileStatus = (typeof fileStatusEnum.enumValues)[number];

export const filesTable = lmsSchema.table(
  "files",
  {
    id: id(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
    purpose: filePurposeEnum("purpose").notNull(),
    delivery: fileDeliveryEnum("delivery").notNull(),
    publicKey: text("public_key"),
    status: fileStatusEnum("status").notNull().default("pending"),
    declaredMime: text("declared_mime").notNull(),
    detectedMime: text("detected_mime"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256"),
    storageKey: text("storage_key").notNull().unique(),
    rejectionReason: text("rejection_reason"),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("files_owner_id_idx").on(table.ownerId),
    index("files_status_idx").on(table.status),
    index("files_purpose_idx").on(table.purpose),
    index("files_public_key_idx").on(table.publicKey),
  ],
);

export const storageReadsTable = lmsSchema.table("storage_reads", {
  day: text("day").primaryKey(), // YYYY-MM-DD UTC
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export type FileRecord = typeof filesTable.$inferSelect;
export type InsertFileRecord = typeof filesTable.$inferInsert;
export type StorageReadRecord = typeof storageReadsTable.$inferSelect;
export { PURPOSE_CONFIGS, type PurposeConfig } from "./purposes";
