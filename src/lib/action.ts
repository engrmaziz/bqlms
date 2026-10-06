import type { z } from "zod";
import { AppError } from "@/lib/errors";
import { err, ok, type Result } from "@/lib/result";

export interface ActionDefinition<TSchema extends z.ZodTypeAny, TOutput> {
  schema: TSchema;
  handler: (input: z.infer<TSchema>) => Promise<TOutput>;
}

export function defineAction<TSchema extends z.ZodTypeAny, TOutput>(
  definition: ActionDefinition<TSchema, TOutput>,
) {
  return async (
    rawInput: unknown,
  ): Promise<
    Result<TOutput, { code: string; message: string; details?: unknown }>
  > => {
    try {
      const parsed = definition.schema.safeParse(rawInput);
      if (!parsed.success) {
        return err({
          code: "VALIDATION",
          message: "Invalid input parameters.",
          details: parsed.error.format(),
        });
      }
      const output = await definition.handler(parsed.data);
      return ok(output);
    } catch (e: unknown) {
      if (e instanceof AppError) {
        return err({
          code: e.code,
          message: e.message,
          details: e.details,
        });
      }
      const message =
        e instanceof Error ? e.message : "Internal error occurred.";
      return err({
        code: "INTERNAL",
        message,
      });
    }
  };
}
