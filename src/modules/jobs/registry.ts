import type { z } from "zod";

export interface JobContext {
  jobId: string;
  attempts: number;
}

export type JobHandler<TPayload> = (
  payload: TPayload,
  ctx: JobContext,
) => Promise<void>;

export interface JobDefinition<TPayload = unknown> {
  schema: z.ZodType<TPayload>;
  handler: JobHandler<TPayload>;
  maxAttempts?: number;
}

const jobRegistry = new Map<string, JobDefinition<unknown>>();

export function registerJob<TPayload>(
  name: string,
  definition: {
    schema: z.ZodType<TPayload>;
    handler: JobHandler<TPayload>;
    maxAttempts?: number;
  },
): void {
  jobRegistry.set(name, definition as unknown as JobDefinition<unknown>);
}

export function getJobDefinition(
  name: string,
): JobDefinition<unknown> | undefined {
  return jobRegistry.get(name);
}

export function listRegisteredJobNames(): string[] {
  return Array.from(jobRegistry.keys());
}
