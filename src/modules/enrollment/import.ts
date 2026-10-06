import { parse } from "csv-parse/sync";
import { and, eq } from "drizzle-orm";
import {
  type CountryCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";
import { uuidv7 } from "uuidv7";
import { z } from "zod";
import { db } from "@/db/client";
import type { Tx } from "@/db/tx";
import { AppError } from "@/lib/errors";
import { sectionsTable, termsTable } from "@/modules/academics/schema";
import { createInvitation } from "@/modules/identity";
import { profilesTable, userTable } from "@/modules/identity/schema";
import { notify } from "@/modules/notifications";
import { enrollStudent } from "./service";

export const MAX_CSV_BYTES = 1024 * 1024; // 1 MB
export const MAX_CSV_ROWS = 2000;

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);

  // Neutralize formula injection
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  if (
    str.includes('"') ||
    str.includes(",") ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export function generateCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const headerLine = headers.map(sanitizeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(sanitizeCsvCell).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}

export function normalizePhone(
  rawPhone?: string | null,
  defaultCountry: CountryCode = "US",
): string | null {
  if (!rawPhone || !rawPhone.trim()) return null;
  const trimmed = rawPhone.trim();
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (parsed?.isValid()) {
      return parsed.format("E.164");
    }
  } catch {
    // Ignore parse error, fallback to trimmed
  }
  return trimmed;
}

export const CsvRowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  role: z.enum(["student", "faculty", "registrar", "admin"]).default("student"),
  student_number: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  term: z.string().optional().nullable(),
  course: z.string().optional().nullable(),
  section: z.string().optional().nullable(),
});

export type ValidatedCsvRow = z.infer<typeof CsvRowSchema>;

export interface ImportError {
  line: number;
  message: string;
  field?: string;
  row?: Record<string, string>;
}

export interface DryRunReport {
  totalRows: number;
  createdUsers: number;
  updatedUsers: number;
  createdEnrollments: number;
  errors: ImportError[];
  preview: Array<{
    line: number;
    name: string;
    email: string;
    role: string;
    isExistingUser: boolean;
    enrollmentIntent?: string | null;
  }>;
}

export interface ImportApplyResult {
  totalRows: number;
  createdUsers: number;
  updatedUsers: number;
  createdEnrollments: number;
  newInvites: Array<{
    userId: string;
    email: string;
    name: string;
    role: string;
    inviteToken: string;
    inviteUrl: string;
  }>;
  downloadableCsv: string;
}

function normalizeHeaders(
  rawRow: Record<string, string>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawRow)) {
    const cleanKey = key
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
    if (cleanKey === "full_name" || cleanKey === "fullname") {
      normalized.name = value;
    } else if (cleanKey === "student_id" || cleanKey === "studentid") {
      normalized.student_number = value;
    } else if (cleanKey === "phone_number") {
      normalized.phone = value;
    } else if (cleanKey === "term_name") {
      normalized.term = value;
    } else if (cleanKey === "course_code") {
      normalized.course = value;
    } else if (cleanKey === "section_code") {
      normalized.section = value;
    } else {
      normalized[cleanKey] = value;
    }
  }
  return normalized;
}

export function parseAndValidateCsv(csvContent: string): {
  rows: ValidatedCsvRow[];
  errors: ImportError[];
} {
  const byteLength = Buffer.byteLength(csvContent, "utf8");
  if (byteLength > MAX_CSV_BYTES) {
    throw new AppError({
      code: "VALIDATION",
      message: `CSV file size exceeds the 1 MB limit (got ${(byteLength / 1024 / 1024).toFixed(2)} MB).`,
    });
  }

  let rawRecords: Array<Record<string, string>>;
  try {
    rawRecords = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err: unknown) {
    throw new AppError({
      code: "VALIDATION",
      message: `Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  if (rawRecords.length > MAX_CSV_ROWS) {
    throw new AppError({
      code: "VALIDATION",
      message: `CSV file exceeds the 2,000 row limit (got ${rawRecords.length} rows).`,
    });
  }

  const rows: ValidatedCsvRow[] = [];
  const errors: ImportError[] = [];

  rawRecords.forEach((raw, idx) => {
    const line = idx + 2; // +1 for 0-index, +1 for header row
    const normalized = normalizeHeaders(raw);

    const parseResult = CsvRowSchema.safeParse(normalized);
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        errors.push({
          line,
          field: issue.path.join("."),
          message: issue.message,
          row: normalized,
        });
      }
    } else {
      rows.push(parseResult.data);
    }
  });

  return { rows, errors };
}

export async function dryRunImport(
  csvContent: string,
  tx?: Tx,
): Promise<DryRunReport> {
  const { rows, errors } = parseAndValidateCsv(csvContent);
  const executor = tx ?? db;

  let createdUsers = 0;
  let updatedUsers = 0;
  let createdEnrollments = 0;
  const preview: DryRunReport["preview"] = [];

  for (const [i, row] of rows.entries()) {
    const line = i + 2;

    // Check if user exists by student_number or email
    let existingUser = null;
    if (row.student_number?.trim()) {
      const [profile] = await executor
        .select({ userId: profilesTable.userId })
        .from(profilesTable)
        .where(eq(profilesTable.studentNumber, row.student_number.trim()))
        .limit(1);

      if (profile) {
        existingUser = profile;
      }
    }

    if (!existingUser) {
      const [user] = await executor
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.email, row.email.toLowerCase().trim()))
        .limit(1);

      if (user) {
        existingUser = user;
      }
    }

    const isExistingUser = Boolean(existingUser);
    if (isExistingUser) {
      updatedUsers++;
    } else {
      createdUsers++;
    }

    let enrollmentIntent: string | null = null;
    if (row.section?.trim() && row.term?.trim()) {
      enrollmentIntent = `${row.term.trim()} - ${row.section.trim()}`;
      createdEnrollments++;
    }

    preview.push({
      line,
      name: row.name,
      email: row.email,
      role: row.role,
      isExistingUser,
      enrollmentIntent,
    });
  }

  return {
    totalRows: rows.length,
    createdUsers,
    updatedUsers,
    createdEnrollments,
    errors,
    preview,
  };
}

export async function applyImport(
  tx: Tx,
  csvContent: string,
  actorUserId: string,
): Promise<ImportApplyResult> {
  const { rows, errors } = parseAndValidateCsv(csvContent);

  if (errors.length > 0) {
    throw new AppError({
      code: "VALIDATION",
      message: `Cannot apply CSV import with ${errors.length} validation error(s). Review dry-run report.`,
      details: errors,
    });
  }

  let createdUsers = 0;
  let updatedUsers = 0;
  let createdEnrollments = 0;
  const newInvites: ImportApplyResult["newInvites"] = [];

  for (const row of rows) {
    const normalizedEmail = row.email.toLowerCase().trim();
    const normalizedPhone = normalizePhone(row.phone);
    const studentNum = row.student_number?.trim() || null;

    // 1. Check existing user by student_number or email
    let userId: string | null = null;
    let isExisting = false;

    if (studentNum) {
      const [profile] = await tx
        .select({ userId: profilesTable.userId })
        .from(profilesTable)
        .where(eq(profilesTable.studentNumber, studentNum))
        .limit(1);

      if (profile) {
        userId = profile.userId;
        isExisting = true;
      }
    }

    if (!userId) {
      const [existingUser] = await tx
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.email, normalizedEmail))
        .limit(1);

      if (existingUser) {
        userId = existingUser.id;
        isExisting = true;
      }
    }

    if (isExisting && userId) {
      // Update existing user details
      await tx
        .update(userTable)
        .set({ name: row.name.trim() })
        .where(eq(userTable.id, userId));

      await tx
        .update(profilesTable)
        .set({
          studentNumber: studentNum,
          phone: normalizedPhone,
        })
        .where(eq(profilesTable.userId, userId));

      updatedUsers++;
    } else {
      // Create new user, profile, invitation
      const newUserId = uuidv7();
      userId = newUserId;

      await tx.insert(userTable).values({
        id: newUserId,
        name: row.name.trim(),
        email: normalizedEmail,
        emailVerified: false,
      });

      await tx.insert(profilesTable).values({
        userId: newUserId,
        roles: [row.role],
        status: "invited",
        studentNumber: studentNum,
        phone: normalizedPhone,
      });

      const { inviteToken, inviteUrl } = await createInvitation(
        {
          email: normalizedEmail,
          roles: [row.role],
          createdBy: actorUserId,
          expiresInDays: 7,
        },
        tx,
      );

      newInvites.push({
        userId: newUserId,
        email: normalizedEmail,
        name: row.name.trim(),
        role: row.role,
        inviteToken,
        inviteUrl,
      });

      createdUsers++;
    }

    // 2. Handle section enrollment if specified
    if (row.section?.trim() && row.term?.trim()) {
      const termSearch = row.term.trim();
      const sectionCode = row.section.trim().toUpperCase();

      const [term] = await tx
        .select()
        .from(termsTable)
        .where(eq(termsTable.name, termSearch))
        .limit(1);

      if (term) {
        const [section] = await tx
          .select()
          .from(sectionsTable)
          .where(
            and(
              eq(sectionsTable.termId, term.id),
              eq(sectionsTable.code, sectionCode),
            ),
          )
          .limit(1);

        if (section) {
          const enrollRes = await enrollStudent(tx, {
            sectionId: section.id,
            studentId: userId,
            source: "import",
            isRegistrarOrAdmin: true,
          });

          if (!enrollRes.alreadyEnrolled) {
            createdEnrollments++;
          }
        }
      }
    }
  }

  // 3. Build downloadable CSV with neutralized formula injection
  const csvHeaders = ["Name", "Email", "Role", "Invite URL"];
  const csvRows = newInvites.map((inv) => [
    inv.name,
    inv.email,
    inv.role,
    inv.inviteUrl,
  ]);
  const downloadableCsv = generateCsv(csvHeaders, csvRows);

  return {
    totalRows: rows.length,
    createdUsers,
    updatedUsers,
    createdEnrollments,
    newInvites,
    downloadableCsv,
  };
}

export async function emailAllInvites(
  tx: Tx,
  invites: Array<{ userId: string; inviteUrl: string; name: string }>,
): Promise<{ enqueued: number }> {
  let enqueued = 0;

  for (const invite of invites) {
    await notify(tx, {
      recipient: invite.userId,
      category: "security",
      template: "default",
      data: {
        title: "Welcome to LMS - Setup Your Account",
        body: `Hello ${invite.name},\n\nYou have been invited to join the LMS. Click the link below to accept your invitation:\n${invite.inviteUrl}`,
        link: invite.inviteUrl,
      },
    });
    enqueued++;
  }

  return { enqueued };
}
