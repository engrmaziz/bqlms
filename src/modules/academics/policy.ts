import { AppError } from "@/lib/errors";
import type { Term } from "./schema";

export function validateTermDates(
  startsOn: Date,
  censusDate: Date,
  endsOn: Date,
): void {
  if (startsOn.getTime() >= endsOn.getTime()) {
    throw new AppError({
      code: "VALIDATION",
      message: "Term start date must be strictly before end date.",
    });
  }
  if (
    censusDate.getTime() < startsOn.getTime() ||
    censusDate.getTime() > endsOn.getTime()
  ) {
    throw new AppError({
      code: "VALIDATION",
      message: "Census date must fall between term start date and end date.",
    });
  }
}

export function validateCourseCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{2,20}$/.test(normalized)) {
    throw new AppError({
      code: "VALIDATION",
      message:
        "Course code must be 2-20 uppercase alphanumeric or hyphen characters.",
    });
  }
  return normalized;
}

export function validateSectionCapacity(capacity: number): void {
  if (!Number.isInteger(capacity) || capacity <= 0 || capacity > 1000) {
    throw new AppError({
      code: "VALIDATION",
      message: "Section capacity must be an integer between 1 and 1000.",
    });
  }
}

export function validateScheduleTime(timeStr: string): void {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(timeStr)) {
    throw new AppError({
      code: "VALIDATION",
      message: 'Schedule time must be in "HH:MM" format (24-hour).',
    });
  }
}

export function validateScheduleInterval(
  startTime: string,
  endTime: string,
): void {
  validateScheduleTime(startTime);
  validateScheduleTime(endTime);
  if (startTime >= endTime) {
    throw new AppError({
      code: "VALIDATION",
      message: "Schedule start time must be strictly before end time.",
    });
  }
}

export function isTermClosed(term: Term): boolean {
  return term.status === "closed";
}
