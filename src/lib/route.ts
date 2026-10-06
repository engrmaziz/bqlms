import { type NextRequest, NextResponse } from "next/server";
import type { z } from "zod";
import { AppError } from "@/lib/errors";

export interface RouteDefinition<TSchema extends z.ZodTypeAny, TOutput> {
  schema?: TSchema;
  handler: (
    input: z.infer<TSchema>,
    req: NextRequest,
  ) => Promise<TOutput | NextResponse>;
}

export function defineRoute<TSchema extends z.ZodTypeAny, TOutput>(
  definition: RouteDefinition<TSchema, TOutput>,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      let data: unknown;
      if (definition.schema) {
        const body =
          req.method !== "GET" && req.method !== "HEAD"
            ? await req.json().catch(() => ({}))
            : Object.fromEntries(req.nextUrl.searchParams.entries());
        const parsed = definition.schema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            {
              code: "VALIDATION",
              message: "Invalid request payload.",
              details: parsed.error.format(),
            },
            { status: 422 },
          );
        }
        data = parsed.data;
      }
      const res = await definition.handler(data as z.infer<TSchema>, req);
      if (res instanceof NextResponse) {
        return res;
      }
      return NextResponse.json(res);
    } catch (e: unknown) {
      if (e instanceof AppError) {
        return NextResponse.json(e.toJSON(), { status: e.status });
      }
      const message = e instanceof Error ? e.message : "Internal server error";
      return NextResponse.json({ code: "INTERNAL", message }, { status: 500 });
    }
  };
}
