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
import { err, ok, type Result } from "@/lib/result";
import { recordAuditLog } from "@/modules/audit";

export interface ActionAuditInfo {
  action: string;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
}

export type ActionAuditResolver<TInput, TOutput> =
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
    ) => Promise<ActionAuditInfo> | ActionAuditInfo);

export interface DefineActionOptions<
  TInputSchema extends z.ZodTypeAny | undefined,
  TOutput,
> {
  input?: TInputSchema;
  permission: Permission;
  resource?: (
    input: TInputSchema extends z.ZodTypeAny
      ? z.infer<TInputSchema>
      : undefined,
    actor: Actor,
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
  audit?: ActionAuditResolver<
    TInputSchema extends z.ZodTypeAny ? z.infer<TInputSchema> : undefined,
    TOutput
  >;
  loaders?: RelationshipLoaders;
  handler: (
    tx: Tx,
    actor: Actor,
    input: TInputSchema extends z.ZodTypeAny
      ? z.infer<TInputSchema>
      : undefined,
  ) => Promise<TOutput>;
}

export interface ActionInvocationContext {
  actor?: Actor;
  ip?: string;
  loaders?: RelationshipLoaders;
  customHeaders?: Headers;
}

export function defineAction<
  TInputSchema extends z.ZodTypeAny | undefined,
  TOutput,
>(definition: DefineActionOptions<TInputSchema, TOutput>) {
  return async (
    rawInput?: unknown,
    context?: ActionInvocationContext,
  ): Promise<Result<TOutput, AppError>> => {
    const requestId = getRequestContext()?.requestId ?? "action-req";

    try {
      // 1. Authenticate (getActor)
      const actor = context?.actor ?? (await getActor(context?.customHeaders));
      if (!actor || actor.status !== "active") {
        return err(
          new AppError({
            code: "UNAUTHENTICATED",
            message: "Authentication required to perform this action.",
          }),
        );
      }

      // 2. Rate limit
      if (definition.rateLimit) {
        const bucket = definition.rateLimit.bucket ?? "write";
        const rateLimitResult = await checkRateLimit({
          bucket,
          identifier: actor.userId,
          limit: definition.rateLimit.limit,
          windowSeconds: definition.rateLimit.windowSeconds,
        });

        if (!rateLimitResult.allowed) {
          return err(
            new AppError({
              code: "RATE_LIMITED",
              message: "Rate limit exceeded. Please try again later.",
              details: {
                retryAfterSeconds: rateLimitResult.retryAfterSeconds,
              },
            }),
          );
        }
      }

      // 3. Validate (zod parse with .strict())
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
          return err(
            new AppError({
              code: "VALIDATION",
              message: "Validation failed for action input.",
              details: parseResult.error.issues,
            }),
          );
        }
        parsedInput = parseResult.data as InferInput;
      }

      // 4. Transaction execution: Authorize -> Execute Handler -> Audit
      return await withTx(async (tx) => {
        // Authorize with scope and loaders
        let resourceCtx: ResourceContext | null | undefined;
        if (definition.resource) {
          resourceCtx = await definition.resource(parsedInput, actor, tx);
        }

        const effectiveLoaders = context?.loaders ?? definition.loaders;
        const isAuthorized = await can(
          actor,
          definition.permission,
          resourceCtx ?? undefined,
          effectiveLoaders,
        );

        if (!isAuthorized) {
          return err(
            new AppError({
              code: "FORBIDDEN",
              message: "You do not have permission to perform this action.",
            }),
          );
        }

        // Execute handler
        const result = await definition.handler(tx, actor, parsedInput);

        // Audit in the same transaction
        if (definition.audit) {
          let auditInfo: ActionAuditInfo;
          if (typeof definition.audit === "function") {
            auditInfo = await definition.audit(parsedInput, result, actor);
          } else {
            const auditConfig = definition.audit;
            const resId =
              typeof auditConfig.resourceId === "function"
                ? await auditConfig.resourceId(parsedInput, result)
                : auditConfig.resourceId;
            const beforeVal = auditConfig.before
              ? await auditConfig.before(parsedInput)
              : undefined;
            const afterVal = auditConfig.after
              ? await auditConfig.after(result)
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
            ip: context?.ip,
            requestId,
          });
        }

        return ok(result);
      });
    } catch (e: unknown) {
      if (e instanceof AppError) {
        return err(e);
      }

      logger.error(
        { err: e, requestId },
        "Unhandled exception in defineAction pipeline",
      );

      return err(
        new AppError({
          code: "INTERNAL",
          message: "An internal server error occurred.",
        }),
      );
    }
  };
}
