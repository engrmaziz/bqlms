import type { NotificationCategory } from "./schema";

export type { NotificationCategory };

export interface CategoryMetadata {
  key: NotificationCategory;
  label: string;
  description: string;
  defaultClass: "immediate" | "digest";
  isSecurity?: boolean;
}

export const NOTIFICATION_CATEGORIES: Record<
  NotificationCategory,
  CategoryMetadata
> = {
  security: {
    key: "security",
    label: "Account & Security",
    description: "Password resets, multi-factor changes, and sign-in alerts",
    defaultClass: "immediate",
    isSecurity: true,
  },
  payment: {
    key: "payment",
    label: "Billing & Financial Decisions",
    description: "Tuition payment confirmations, holds, and emergency fees",
    defaultClass: "immediate",
  },
  exam: {
    key: "exam",
    label: "Exams & Tests (< 2h)",
    description:
      "Imminent examinations, test cutoffs, and session start warnings",
    defaultClass: "immediate",
  },
  deadline: {
    key: "deadline",
    label: "Urgent Deadlines (< 2h)",
    description: "Imminent assignment and coursework submission deadlines",
    defaultClass: "immediate",
  },
  announcement: {
    key: "announcement",
    label: "Campus Announcements",
    description: "Institutional updates and college-wide news bulletins",
    defaultClass: "digest",
  },
  content: {
    key: "content",
    label: "Course Materials",
    description: "New lecture materials, reading lists, and syllabus updates",
    defaultClass: "digest",
  },
  grade: {
    key: "grade",
    label: "Grades & Evaluation",
    description: "Released assessment marks, rubric feedback, and transcripts",
    defaultClass: "digest",
  },
  forum: {
    key: "forum",
    label: "Discussion Forums",
    description: "Replies to discussion threads and question responses",
    defaultClass: "digest",
  },
  message: {
    key: "message",
    label: "Direct Messages",
    description: "Messages from faculty advisors and academic instructors",
    defaultClass: "digest",
  },
  absence: {
    key: "absence",
    label: "Attendance & Absences",
    description: "Recorded class absences and attendance threshold alerts",
    defaultClass: "digest",
  },
  reminder: {
    key: "reminder",
    label: "General Reminders",
    description:
      "Upcoming events, registration openings, and timetable notices",
    defaultClass: "digest",
  },
};

export const ALL_CATEGORIES = Object.values(NOTIFICATION_CATEGORIES);

export function getCategoryMetadata(category: string): CategoryMetadata {
  return (
    NOTIFICATION_CATEGORIES[category as NotificationCategory] ?? {
      key: "announcement",
      label: category,
      description: "General notification",
      defaultClass: "digest",
    }
  );
}

export function getDefaultDeliveryClass(
  category: string,
): "immediate" | "digest" {
  return getCategoryMetadata(category).defaultClass;
}

export function isSecurityCategory(category: string): boolean {
  return category === "security";
}
