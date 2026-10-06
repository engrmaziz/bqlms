import { eq } from "drizzle-orm";
import { type Database, db } from "@/db/client";
import type { Tx } from "@/db/tx";
import {
  type Invitation,
  invitationsTable,
  type PasswordResetLink,
  type Profile,
  passwordResetLinksTable,
  profilesTable,
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
