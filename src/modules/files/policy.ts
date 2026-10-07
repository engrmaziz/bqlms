import type { Actor } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { PURPOSE_CONFIGS } from "./purposes";
import type { FileDelivery, FilePurpose, FileRecord } from "./schema";

export function canUploadFile(
  actor: Actor,
  purpose: FilePurpose,
  delivery: FileDelivery,
): void {
  const config = PURPOSE_CONFIGS[purpose];
  if (!config) {
    throw new AppError({
      code: "VALIDATION",
      message: `Unsupported file purpose: ${purpose}`,
    });
  }

  // Delivery mode invariant: purpose defines whether it's CDN or signed
  if (delivery !== config.delivery) {
    throw new AppError({
      code: "VALIDATION",
      message: `Invalid delivery mode "${delivery}" for purpose "${purpose}". Must be "${config.delivery}".`,
    });
  }

  // Submissions and payment proofs can NEVER be public CDN
  if (
    (purpose === "submission" || purpose === "payment_proof") &&
    delivery === "cdn"
  ) {
    throw new AppError({
      code: "VALIDATION",
      message: `Purpose "${purpose}" is confidential student/financial data and can never be delivered via CDN.`,
    });
  }

  // Check upload:create permission
  const hasPermission =
    actor.roles.includes("super_admin") ||
    actor.roles.includes("admin") ||
    actor.roles.includes("faculty") ||
    actor.roles.includes("student") ||
    actor.roles.includes("registrar");

  if (!hasPermission) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "You do not have permission to upload files.",
    });
  }
}

export interface DownloadAuthContext {
  isInstructor?: boolean;
  isEnrolled?: boolean;
}

export function canDownloadFile(
  actor: Actor,
  file: FileRecord,
  context?: DownloadAuthContext,
): boolean {
  // Deleted or rejected files cannot be accessed
  if (file.deletedAt || file.status === "deleted") {
    return false;
  }
  if (file.status === "rejected") {
    return false;
  }

  // Super admins and admins have college-wide access
  if (actor.roles.includes("super_admin") || actor.roles.includes("admin")) {
    return true;
  }

  // Registrars can view payment proofs and student records
  if (actor.roles.includes("registrar")) {
    if (
      file.purpose === "payment_proof" ||
      file.purpose === "lesson_document"
    ) {
      return true;
    }
  }

  // Owners can always download their own uploaded files
  if (file.ownerId === actor.userId) {
    return true;
  }

  // Student work: only the owner, instructors, or admins can download
  if (file.purpose === "submission") {
    if (context?.isInstructor || actor.roles.includes("faculty")) {
      return true;
    }
    // A student cannot download another student's submission
    return false;
  }

  // Payment proofs: confidential to student owner and registrar/admin
  if (file.purpose === "payment_proof") {
    return false;
  }

  // Course content (lesson documents, SCORM packages): accessible to instructors and enrolled students
  if (file.purpose === "lesson_document" || file.purpose === "scorm_package") {
    if (
      actor.roles.includes("faculty") ||
      context?.isInstructor ||
      context?.isEnrolled
    ) {
      return true;
    }
  }

  return false;
}

export function canDeleteFile(actor: Actor, file: FileRecord): boolean {
  if (actor.roles.includes("super_admin") || actor.roles.includes("admin")) {
    return true;
  }
  return file.ownerId === actor.userId;
}
