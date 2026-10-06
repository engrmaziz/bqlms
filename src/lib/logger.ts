import pino from "pino";
import { getRequestContext } from "@/lib/request-context";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "authorization",
      "cookie",
      "password",
      "token",
      "headers.authorization",
      "headers.cookie",
      "*.authorization",
      "*.cookie",
      "*.password",
      "*.token",
    ],
    censor: "[REDACTED]",
  },
  mixin() {
    const context = getRequestContext();
    if (!context) {
      return {};
    }
    const mixinFields: Record<string, unknown> = {
      requestId: context.requestId,
    };
    if (context.userId !== undefined) {
      mixinFields.userId = context.userId;
    }
    return mixinFields;
  },
});

export type Logger = typeof logger;
export default logger;
