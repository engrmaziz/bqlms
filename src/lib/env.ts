import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(3000),
    DATABASE_URL: z.string().url(),
    DATABASE_URL_SESSION: z.string().url(),
    BUILD_STANDALONE: z.enum(["0", "1"]).optional(),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(16)
      .default("super-secret-better-auth-key-at-least-32-chars-long!"),
    BETTER_AUTH_URL: z.string().url().default("http://localhost:8080"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    CSP_CONNECT_SRC: z.string().optional(),
    CSP_FRAME_SRC: z.string().optional(),
    CRON_SECRET: z
      .string()
      .min(16)
      .default("super-secret-cron-token-at-least-16-chars-long!"),
    HEARTBEAT_URL: z.string().url().optional(),
    EMAIL_DAILY_CAP: z.coerce.number().default(250),
    EMAIL_PROVIDER: z.enum(["smtp", "fake"]).default("smtp"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().default(1025),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default("BQLMS <no-reply@college.edu>"),
    SMTP_SECURE: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_SESSION: process.env.DATABASE_URL_SESSION,
    BUILD_STANDALONE: process.env.BUILD_STANDALONE,
    LOG_LEVEL: process.env.LOG_LEVEL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    CSP_CONNECT_SRC: process.env.CSP_CONNECT_SRC,
    CSP_FRAME_SRC: process.env.CSP_FRAME_SRC,
    CRON_SECRET: process.env.CRON_SECRET,
    HEARTBEAT_URL: process.env.HEARTBEAT_URL,
    EMAIL_DAILY_CAP: process.env.EMAIL_DAILY_CAP,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    SMTP_SECURE: process.env.SMTP_SECURE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  emptyStringAsUndefined: true,
});
