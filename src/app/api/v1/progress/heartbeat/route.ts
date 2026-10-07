import { z } from "zod";
import { defineRoute } from "@/lib/api/define-route";
import { AppError } from "@/lib/errors";
import { recordHeartbeat } from "@/modules/progress";

// In-memory rate limiting map for heartbeat route: `${userId}:${lessonId}` -> lastHeartbeatTimestamp
const lastHeartbeatMap = new Map<string, number>();

export const POST = defineRoute({
  permission: "course:read",
  input: z.object({
    lessonId: z.string().uuid(),
    currentPositionS: z.number().nonnegative().optional(),
    intervals: z.array(z.tuple([z.number(), z.number()])).optional(),
    dwellSeconds: z.number().nonnegative().optional(),
    isEndReached: z.boolean().optional(),
    isBeacon: z.boolean().optional(),
  }),
  handler: async (tx, actor, input) => {
    if (!actor) {
      throw new AppError({
        code: "UNAUTHENTICATED",
        message: "Authentication required to submit progress heartbeat.",
      });
    }

    const now = Date.now();
    const rateLimitKey = `${actor.userId}:${input.lessonId}`;
    const lastTimestamp = lastHeartbeatMap.get(rateLimitKey);

    // Rate limit rule: At most one request per 60 seconds per open lesson, plus one on pagehide via sendBeacon
    if (!input.isBeacon && lastTimestamp && now - lastTimestamp < 55_000) {
      throw new AppError({
        code: "RATE_LIMITED",
        message:
          "Heartbeat rate limit exceeded: maximum one request per 60 seconds per lesson.",
      });
    }

    lastHeartbeatMap.set(rateLimitKey, now);

    const result = await recordHeartbeat(tx, actor, {
      lessonId: input.lessonId,
      currentPositionS: input.currentPositionS,
      intervals: input.intervals,
      dwellSeconds: input.dwellSeconds,
      isEndReached: input.isEndReached,
      isBeacon: input.isBeacon,
    });

    return {
      success: true,
      progressPct: result.progress.progressPct,
      status: result.progress.status,
      sectionCompleted: result.sectionCompleted,
    };
  },
});
