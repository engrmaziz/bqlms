import { eq } from "drizzle-orm";
import { type Database, db } from "@/db/client";
import type { Tx } from "@/db/tx";
import {
  type Invitation,
  invitationsTable,
  type PasswordResetLink,
  type Profile,
  type ProfileStatus,
  passwordResetLinksTable,
  profilesTable,
  type Role,
  type User,
  userTable,
} from "./schema";

export async function getProfileByUserId(
  userId: string,
  executor: Database | Tx = db,
): Promise<Profile | null> {
  const [profile] = await executor
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  return profile ?? null;
}

export async function getUserByEmail(
  email: string,
  executor: Database | Tx = db,
): Promise<User | null> {
  const normalized = email.trim().toLowerCase().normalize("NFC");
  const [user] = await executor
    .select()
    .from(userTable)
    .where(eq(userTable.email, normalized))
    .limit(1);

  return user ?? null;
}

export async function getInvitationByTokenHash(
  tokenHash: string,
  executor: Database | Tx = db,
): Promise<Invitation | null> {
  const [invitation] = await executor
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.tokenHash, tokenHash))
    .limit(1);

  return invitation ?? null;
}

export async function getPasswordResetLinkByTokenHash(
  tokenHash: string,
  executor: Database | Tx = db,
): Promise<PasswordResetLink | null> {
  const [link] = await executor
    .select()
    .from(passwordResetLinksTable)
    .where(eq(passwordResetLinksTable.tokenHash, tokenHash))
    .limit(1);

  return link ?? null;
}

export async function countActiveSuperAdmins(
  executor: Database | Tx = db,
): Promise<number> {
  const rows = await executor
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.status, "active"));

  return rows.filter((p) => p.roles.includes("super_admin")).length;
}

export interface UserWithProfile {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  status: ProfileStatus;
  studentNumber: string | null;
  employeeId: string | null;
  phone: string | null;
  createdAt: Date;
}

export async function listUsersWithProfiles(
  params: {
    search?: string;
    status?: ProfileStatus;
    limit?: number;
    offset?: number;
  } = {},
  executor: Database | Tx = db,
): Promise<UserWithProfile[]> {
  const rows = await executor
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      roles: profilesTable.roles,
      status: profilesTable.status,
      studentNumber: profilesTable.studentNumber,
      employeeId: profilesTable.employeeId,
      phone: profilesTable.phone,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .innerJoin(profilesTable, eq(userTable.id, profilesTable.userId))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0);

  let filtered = rows;
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.studentNumber?.toLowerCase().includes(q),
    );
  }

  if (params.status) {
    filtered = filtered.filter((u) => u.status === params.status);
  }

  return filtered;
}

export async function listInvitations(
  executor: Database | Tx = db,
): Promise<Invitation[]> {
  return executor.select().from(invitationsTable);
}

export async function deleteInvitationById(
  id: string,
  executor: Database | Tx = db,
): Promise<void> {
  await executor.delete(invitationsTable).where(eq(invitationsTable.id, id));
}

export async function getUserWithProfile(
  userId: string,
  executor: Database | Tx = db,
): Promise<UserWithProfile | null> {
  const [row] = await executor
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      roles: profilesTable.roles,
      status: profilesTable.status,
      studentNumber: profilesTable.studentNumber,
      employeeId: profilesTable.employeeId,
      phone: profilesTable.phone,
      createdAt: userTable.createdAt,
    })
    .from(userTable)
    .innerJoin(profilesTable, eq(userTable.id, profilesTable.userId))
    .where(eq(userTable.id, userId))
    .limit(1);

  return row ?? null;
}
