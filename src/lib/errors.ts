export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "RATE_LIMITED",
  "PRECONDITION_FAILED",
  "QUOTA_EXCEEDED",
  "UPSTREAM_UNAVAILABLE",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PRECONDITION_FAILED: 412,
  QUOTA_EXCEEDED: 429,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL: 500,
} as const;

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.status = ERROR_STATUS_MAP[options.code];
    if (options.details !== undefined) {
      this.details = options.details;
    }
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}
