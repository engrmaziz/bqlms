import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Tx } from "@/db/tx";
import { withTx } from "@/db/tx";
import type { Actor } from "@/lib/auth/session";
import { getActor } from "@/lib/auth/session";
import { can } from "@/lib/authz/can";
import type { Permission } from "@/lib/authz/permissions";
import type { RelationshipLoaders, ResourceContext } from "@/lib/authz/scope";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { checkRateLimit, type RateLimitBucket } from "@/lib/rate-limit";
import { getRequestContext } from "@/lib/request-context";
import { recordAuditLog } from "@/modules/audit";
import {
  checkIdempotency,
  computeRequestHash,
  saveIdempotencyRecord,
} from "@/modules/idempotency";

export interface RouteAuditInfo {
  action: string;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
}

export type RouteAuditResolver<TInput, TOutput> =
  | {
      action: string;
      resourceType: string;
      resourceId:
        | string
        | ((input: TInput, output: TOutput) => string | Promise<string>);
      before?: (input: TInput) => Promise<unknown> | unknown;
      after?: (output: TOutput) => Promise<unknown> | unknown;
    }
  | ((
      input: TInput,
      output: TOutput,
      actor: Actor,
    ) => Promise<RouteAuditInfo> | RouteAuditInfo);

export interface DefineRouteOptions<
  TInputSchema extends z.ZodTypeAny | undefined,
  TOutput,
> {
  input?: TInputSchema;
  permission?: Permission;
  public?: boolean;
  resource?: (
    input: TInputSchema extends z.ZodTypeAny
      ? z.infer<TInputSchema>
      : undefined,
    actor: Actor | null,
    tx: Tx,
  ) =>
    | Promise<ResourceContext | null | undefined>
    | ResourceContext
    | null
    | undefined;
  rateLimit?: {
    bucket?: RateLimitBucket;
    limit?: number;
    windowSeconds?: number;
  };
  audit?: RouteAuditResolver<
    TInputSchema extends z.ZodTypeAny ? z.infer<TInputSchema> : undefined,
    TOutput
  >;
  loaders?: RelationshipLoaders;
  successStatus?: number;
  handler: (
    tx: Tx,
    actor: Actor | null,
    input: TInputSchema extends z.ZodTypeAny
      ? z.infer<TInputSchema>
      : undefined,
    req: NextRequest,
  ) => Promise<TOutput>;
}

export interface RouteInvocationContext {
  params?:
    | Promise<Record<string, string | string[]>>
    | Record<string, string | string[]>;
  actor?: Actor;
  loaders?: RelationshipLoaders;
}

export function defineRoute<
  TInputSchema extends z.ZodTypeAny | undefined,
  TOutput,
>(definition: DefineRouteOptions<TInputSchema, TOutput>) {
  return async (req: NextRequest, context?: unknown): Promise<NextResponse> => {
    const routeCtx = context as RouteInvocationContext | undefined;
    const requestId =
      req.headers.get("x-request-id") ||
      getRequestContext()?.requestId ||
      "route-req";
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const idempotencyKey =
      req.headers.get("idempotency-key") || req.headers.get("Idempotency-Key");

    try {
      // 1. Authenticate (getActor)
      const actor = routeCtx?.actor ?? (await getActor(req.headers));
      if (!definition.public && (!actor || actor.status !== "active")) {
        return NextResponse.json(
          {
            code: "UNAUTHENTICATED",
            message: "Authentication required to access this endpoint.",
          },
          { status: 401 },
        );
      }

      // 2. Extract Raw Input
      let rawInput: unknown;
      if (req.method === "GET" || req.method === "HEAD") {
        rawInput = Object.fromEntries(req.nextUrl.searchParams.entries());
      } else {
        const text = await req.text();
        if (text && text.trim().length > 0) {
          try {
            rawInput = JSON.parse(text);
          } catch {
            return NextResponse.json(
              {
                code: "VALIDATION",
                message: "Malformed JSON payload.",
              },
              { status: 400 },
            );
          }
        } else {
          rawInput = {};
        }
      }

      // 3. Idempotency Check (if key provided)
      let requestHash = "";
      const effectiveActorId = actor?.userId ?? `anon:${ip}`;
      if (idempotencyKey) {
        requestHash = computeRequestHash({
          method: req.method,
          path: req.nextUrl.pathname,
          body: rawInput,
        });

        const idempCheck = await checkIdempotency(
          idempotencyKey,
          effectiveActorId,
          requestHash,
        );

        if (idempCheck.state === "replay") {
          const replayData = idempCheck.response as {
            status: number;
            body: unknown;
          };
          return NextResponse.json(replayData.body, {
            status: replayData.status,
            headers: { "X-Idempotent-Replay": "true" },
          });
        }

        if (idempCheck.state === "conflict") {
          return NextResponse.json(
            {
              code: "CONFLICT",
              message: "Idempotency key reused with different request payload.",
            },
            { status: 409 },
          );
        }
      }

      // 4. Rate Limiting
      if (definition.rateLimit) {
        const bucket =
          definition.rateLimit.bucket ?? (definition.public ? "auth" : "write");
        const rlResult = await checkRateLimit({
          bucket,
          identifier: actor?.userId ?? ip,
          limit: definition.rateLimit.limit,
          windowSeconds: definition.rateLimit.windowSeconds,
        });

        if (!rlResult.allowed) {
          return NextResponse.json(
            {
              code: "RATE_LIMITED",
              message: "Rate limit exceeded. Please try again later.",
              details: { retryAfterSeconds: rlResult.retryAfterSeconds },
            },
            {
              status: 429,
              headers: {
                "Retry-After": String(rlResult.retryAfterSeconds),
              },
            },
          );
        }
      }

      // 5. Validate Input (zod parse with .strict())
      type InferInput = TInputSchema extends z.ZodTypeAny
        ? z.infer<TInputSchema>
        : undefined;
      let parsedInput: InferInput = undefined as InferInput;

      if (definition.input) {
        const schema =
          definition.input instanceof z.ZodObject
            ? definition.input.strict()
            : definition.input;

        const parseResult = schema.safeParse(rawInput);
        if (!parseResult.success) {
          return NextResponse.json(
            {
              code: "VALIDATION",
              message: "Validation failed for request parameters.",
              details: parseResult.error.issues,
            },
            { status: 422 },
          );
        }
        parsedInput = parseResult.data as InferInput;
      }

      // 6. Transaction Execution: Authorize -> Handler -> Audit
      const executionResult = await withTx(async (tx) => {
        let resourceCtx: ResourceContext | null | undefined;
        if (definition.resource) {
          resourceCtx = await definition.resource(parsedInput, actor, tx);
        }

        if (!definition.public) {
          if (!actor || !definition.permission) {
            throw new AppError({
              code: "FORBIDDEN",
              message: "You do not have permission to access this resource.",
            });
          }

          const isAuthorized = await can(
            actor,
            definition.permission,
            resourceCtx ?? undefined,
            definition.loaders,
          );

          if (!isAuthorized) {
            throw new AppError({
              code: "FORBIDDEN",
              message: "You do not have permission to access this resource.",
            });
          }
        }

        const output = await definition.handler(tx, actor, parsedInput, req);

        // Audit in the same transaction
        if (definition.audit && actor) {
          let auditInfo: RouteAuditInfo;
          if (typeof definition.audit === "function") {
            auditInfo = await definition.audit(parsedInput, output, actor);
          } else {
            const auditConfig = definition.audit;
            const resId =
              typeof auditConfig.resourceId === "function"
                ? await auditConfig.resourceId(parsedInput, output)
                : auditConfig.resourceId;
            const beforeVal = auditConfig.before
              ? await auditConfig.before(parsedInput)
              : undefined;
            const afterVal = auditConfig.after
              ? await auditConfig.after(output)
              : undefined;

            auditInfo = {
              action: auditConfig.action,
              resourceType: auditConfig.resourceType,
              resourceId: resId,
              before: beforeVal,
              after: afterVal,
            };
          }

          await recordAuditLog(tx, {
            actorId: actor.userId,
            action: auditInfo.action,
            resourceType: auditInfo.resourceType,
            resourceId: auditInfo.resourceId,
            before: auditInfo.before,
            after: auditInfo.after,
            ip,
            requestId,
          });
        }

        return output;
      });

      const statusCode = definition.successStatus ?? 200;

      // 7. Store Idempotent Response if requested
      if (idempotencyKey) {
        await saveIdempotencyRecord(
          await import("@/db/client").then((m) => m.db),
          {
            key: idempotencyKey,
            actorId: effectiveActorId,
            requestHash,
            response: {
              status: statusCode,
              body: executionResult,
            },
          },
        );
      }

      return NextResponse.json(executionResult, { status: statusCode });
    } catch (e: unknown) {
      if (e instanceof AppError) {
        return NextResponse.json(e.toJSON(), { status: e.status });
      }

      logger.error(
        { err: e, requestId },
        "Unhandled exception in defineRoute pipeline",
      );

      return NextResponse.json(
        {
          code: "INTERNAL",
          message: "An unexpected error occurred.",
        },
        { status: 500 },
      );
    }
  };
}
