import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { withTx } from "@/db/tx";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { drainJobs, scheduleRecurringJobs } from "@/modules/jobs";
import "@/modules/files";
import "@/modules/notifications";
import "@/modules/webhooks";

export const maxDuration = 60;

function timingSafeEqualStr(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized: Missing or malformed authorization header" },
      { status: 401 },
    );
  }

  const token = authHeader.slice(7).trim();
  if (!timingSafeEqualStr(token, env.CRON_SECRET)) {
    return NextResponse.json(
      { error: "Forbidden: Invalid cron secret" },
      { status: 403 },
    );
  }

  try {
    // 1. Enqueue recurring jobs
    await withTx(async (tx) => {
      await scheduleRecurringJobs(tx);
    });

    // 2. Drain due jobs with a 45s budget
    const drainResult = await drainJobs(45);

    // 3. Heartbeat ping if configured
    if (env.HEARTBEAT_URL) {
      try {
        await fetch(env.HEARTBEAT_URL, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        logger.warn(
          { err, url: env.HEARTBEAT_URL },
          "Failed to ping heartbeat URL",
        );
      }
    }

    return NextResponse.json({
      success: true,
      processed: drainResult.processed,
      succeeded: drainResult.succeeded,
      failed: drainResult.failed,
    });
  } catch (error) {
    logger.error({ error }, "Error executing internal tick endpoint");
    return NextResponse.json(
      { error: "Internal Server Error during tick execution" },
      { status: 500 },
    );
  }
}
