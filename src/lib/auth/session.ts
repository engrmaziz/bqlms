import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { auth } from "@/lib/auth/auth";
import { AppError } from "@/lib/errors";
import {
  getProfileByUserId,
  type Profile,
  type ProfileStatus,
  type Role,
} from "@/modules/identity";

export interface Actor {
  userId: string;
  email: string;
  name: string;
  roles: Role[];
  status: ProfileStatus;
  twoFactorEnabled: boolean;
  profile: Profile;
}

export const getActor = cache(
  async (customHeaders?: Headers): Promise<Actor | null> => {
    let reqHeaders: Headers;
    if (customHeaders) {
      reqHeaders = customHeaders;
    } else {
      try {
        reqHeaders = await headers();
      } catch {
        reqHeaders = new Headers();
      }
    }
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user) {
      return null;
    }

    const profile = await getProfileByUserId(session.user.id);
    if (!profile) {
      return null;
    }

    if (profile.status === "suspended") {
      // Revoke session if user is suspended
      await auth.api
        .revokeSession({
          headers: reqHeaders,
          body: { token: session.session.token },
        })
        .catch(() => {});
      return null;
    }

    return {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      roles: profile.roles,
      status: profile.status,
      twoFactorEnabled: Boolean(session.user.twoFactorEnabled),
      profile,
    };
  },
);

export async function requireActor(customHeaders?: Headers): Promise<Actor> {
  const actor = await getActor(customHeaders);
  if (!actor) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Authentication required to access this resource.",
    });
  }
  return actor;
}

export async function requireFreshSession(
  maxAgeMinutes = 10,
  customHeaders?: Headers,
): Promise<Actor> {
  let reqHeaders: Headers;
  if (customHeaders) {
    reqHeaders = customHeaders;
  } else {
    try {
      reqHeaders = await headers();
    } catch {
      reqHeaders = new Headers();
    }
  }
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Authentication required to access this resource.",
    });
  }

  const sessionCreatedAt = new Date(session.session.createdAt).getTime();
  const ageMs = Date.now() - sessionCreatedAt;
  if (ageMs > maxAgeMinutes * 60 * 1000) {
    throw new AppError({
      code: "PRECONDITION_FAILED",
      message:
        "Fresh authentication required for this sensitive action. Please sign in again.",
    });
  }

  return requireActor(customHeaders);
}
