import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { uuidv7 } from "uuidv7";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { getProfileByUserId } from "@/modules/identity";
import { getSettings } from "@/modules/settings";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.userTable,
      session: schema.sessionTable,
      account: schema.accountTable,
      verification: schema.verificationTable,
      twoFactor: schema.twoFactorTable,
      rateLimit: schema.rateLimitTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true, // Public signup disabled, invites/CSV only
    requireEmailVerification: false,
    autoSignIn: false,
  },
  socialProviders: {
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          try {
            const profile = await getProfileByUserId(session.userId);
            const isStaff = profile?.roles.some((r: string) => r !== "student");
            const now = Date.now();
            const durationMs = isStaff
              ? 12 * 60 * 60 * 1000 // 12 hours for staff
              : 30 * 24 * 60 * 60 * 1000; // 30 days for students
            return {
              data: {
                ...session,
                expiresAt: new Date(now + durationMs),
              },
            };
          } catch {
            return { data: session };
          }
        },
      },
    },
    user: {
      create: {
        before: async (user) => {
          if (user.email) {
            const settings = await getSettings();
            const normalizedEmail = user.email
              .trim()
              .toLowerCase()
              .normalize("NFC");
            const domain = normalizedEmail.split("@")[1];
            const allowedDomains = (
              settings.policies as Record<string, unknown>
            )?.allowedEmailDomains as string[] | undefined;
            if (allowedDomains && allowedDomains.length > 0 && domain) {
              if (!allowedDomains.includes(domain)) {
                throw new Error(
                  "Your email domain is not authorized for sign-in.",
                );
              }
            }
          }
        },
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes signed session cookie cache
    },
    expiresIn: 30 * 24 * 60 * 60, // 30 days sliding default
    updateAge: 24 * 60 * 60,
  },
  rateLimit: {
    storage: "database",
    modelName: "rateLimit",
    window: 10,
    max: 100,
    customRules: {
      "/sign-in/*": {
        window: 10,
        max: 100,
      },
      "/sign-up/*": {
        window: 10,
        max: 100,
      },
    },
  },
  advanced: {
    generateId: () => uuidv7(),
    useSecureCookies: env.NODE_ENV === "production",
    cookiePrefix: env.NODE_ENV === "production" ? "__Host-bqlms" : "bqlms",
    defaultCookieAttributes: {
      secure: env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  },
  plugins: [
    twoFactor({
      issuer: "Open College LMS",
    }),
  ],
});

export type Auth = typeof auth;
