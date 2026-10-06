import { AppError } from "@/lib/errors";
import type { Section, Term } from "@/modules/academics/schema";

export function assertSectionAvailableForEnrollment(
  section: Section,
  term: Term,
  isRegistrarOrAdmin: boolean = false,
  overrideReason?: string | null,
): void {
  if (section.status !== "published" && !isRegistrarOrAdmin) {
    throw new AppError({
      code: "PRECONDITION_FAILED",
      message: `Section "${section.code}" is ${section.status} and not open for enrollment.`,
    });
  }

  if (term.status === "closed") {
    if (!isRegistrarOrAdmin || !overrideReason?.trim()) {
      throw new AppError({
        code: "PRECONDITION_FAILED",
        message:
          "Cannot enroll in a closed term without a registrar override with a reason.",
      });
    }
  }
}
