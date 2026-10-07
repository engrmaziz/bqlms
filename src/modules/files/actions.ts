"use server";

import { z } from "zod";
import { defineAction } from "@/lib/actions/define-action";
import { fileDeliveryEnum, filePurposeEnum } from "./schema";
import {
  completeUpload,
  deleteFile,
  type RequestUploadResult,
  requestUpload,
} from "./service";

export const requestUploadAction = defineAction({
  permission: "upload:create",
  rateLimit: { bucket: "write", limit: 60, windowSeconds: 60 },
  input: z.object({
    purpose: z.enum(filePurposeEnum.enumValues),
    name: z.string().min(1).max(255),
    size: z.number().int().positive(),
    mime: z.string().min(1).max(128),
    delivery: z.enum(fileDeliveryEnum.enumValues).optional(),
  }),
  audit: {
    action: "file:upload_request",
    resourceType: "file",
    resourceId: (_input, output: RequestUploadResult) => output.file.id,
  },
  handler: async (tx, actor, input) => {
    return requestUpload(tx, actor, input);
  },
});

export const completeUploadAction = defineAction({
  permission: "upload:create",
  rateLimit: { bucket: "write", limit: 60, windowSeconds: 60 },
  input: z.object({
    fileId: z.string().uuid(),
  }),
  audit: {
    action: "file:upload_complete",
    resourceType: "file",
    resourceId: (input) => input.fileId,
  },
  handler: async (tx, actor, input) => {
    return completeUpload(tx, actor, input.fileId);
  },
});

export const deleteFileAction = defineAction({
  permission: "upload:create",
  rateLimit: { bucket: "write", limit: 60, windowSeconds: 60 },
  input: z.object({
    fileId: z.string().uuid(),
  }),
  audit: {
    action: "file:delete",
    resourceType: "file",
    resourceId: (input) => input.fileId,
  },
  handler: async (tx, actor, input) => {
    return deleteFile(tx, actor, input.fileId);
  },
});
