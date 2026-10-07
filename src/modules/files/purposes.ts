import type { FileDelivery, FilePurpose } from "./schema";

export interface PurposeConfig {
  purpose: FilePurpose;
  maxSizeBytes: number;
  delivery: FileDelivery;
  allowedMimeTypes: readonly string[];
  allowedExtensions: readonly string[];
}

export const DISALLOWED_MIME_PATTERNS = [
  /^application\/x-msdownload/i,
  /^application\/x-executable/i,
  /^application\/x-elf/i,
  /^application\/x-dosexec/i,
  /^application\/vnd\.microsoft\.portable-executable/i,
  /^application\/x-sh/i,
  /^application\/x-bat/i,
  /^application\/x-csh/i,
  /^application\/javascript/i,
  /^text\/javascript/i,
  /^text\/html/i,
  /^image\/svg\+xml/i,
  /macroenabled/i,
  /^video\//i, // Video uploads are strictly prohibited (Prompt 8: Video is unlisted YouTube only)
];

export const DISALLOWED_EXTENSIONS = new Set([
  "exe",
  "dll",
  "so",
  "bin",
  "bat",
  "cmd",
  "sh",
  "ps1",
  "vbs",
  "js",
  "mjs",
  "cjs",
  "ts",
  "jsx",
  "tsx",
  "php",
  "py",
  "rb",
  "pl",
  "html",
  "htm",
  "xhtml",
  "svg",
  "xml",
  "docm",
  "xlsm",
  "pptm",
  "dotm",
  "xltm",
  "potm",
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm", // no video uploads
]);

export const PURPOSE_CONFIGS: Record<FilePurpose, PurposeConfig> = {
  lesson_document: {
    purpose: "lesson_document",
    maxSizeBytes: 20 * 1024 * 1024, // 20 MB
    delivery: "signed",
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "text/plain",
      "text/csv",
      "application/rtf",
      "application/vnd.oasis.opendocument.text",
    ],
    allowedExtensions: [
      "pdf",
      "docx",
      "doc",
      "xlsx",
      "xls",
      "pptx",
      "ppt",
      "txt",
      "csv",
      "rtf",
      "odt",
    ],
  },
  lesson_image: {
    purpose: "lesson_image",
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    delivery: "cdn",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "gif"],
  },
  avatar: {
    purpose: "avatar",
    maxSizeBytes: 512 * 1024, // 512 KB
    delivery: "cdn",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedExtensions: ["jpg", "jpeg", "png", "webp"],
  },
  submission: {
    purpose: "submission",
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    delivery: "signed",
    allowedMimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
      "text/plain",
      "text/csv",
      "application/zip",
      "application/x-zip-compressed",
    ],
    allowedExtensions: [
      "pdf",
      "docx",
      "doc",
      "xlsx",
      "xls",
      "pptx",
      "ppt",
      "txt",
      "csv",
      "zip",
    ],
  },
  payment_proof: {
    purpose: "payment_proof",
    maxSizeBytes: 3 * 1024 * 1024, // 3 MB
    delivery: "signed",
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ],
    allowedExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
  },
  scorm_package: {
    purpose: "scorm_package",
    maxSizeBytes: 50 * 1024 * 1024, // 50 MB
    delivery: "signed",
    allowedMimeTypes: [
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
    ],
    allowedExtensions: ["zip"],
  },
};

export function sanitizeFilename(filename: string): string {
  // Extract base filename without directories
  const base = filename.replace(/^.*[\\/]/, "");
  // Replace invalid characters with underscore
  const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Prevent leading dot or empty filename
  return sanitized.replace(/^\.+/, "") || "unnamed_file";
}

export function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
}

export function buildStorageKey(
  purpose: FilePurpose,
  fileId: string,
  filename: string,
): string {
  const cleanName = sanitizeFilename(filename);
  return `${purpose}/${fileId}/${cleanName}`;
}

export function isMimeDisallowed(mime: string): boolean {
  return DISALLOWED_MIME_PATTERNS.some((pattern) => pattern.test(mime));
}

export function isExtensionDisallowed(ext: string): boolean {
  return DISALLOWED_EXTENSIONS.has(ext.toLowerCase());
}
