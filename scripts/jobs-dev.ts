import { withTx } from "@/db/tx";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { drainJobs, scheduleRecurringJobs } from "@/modules/jobs";

const INTERVAL_MS = 5000;
const appUrl =
  process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${env.PORT}`;
const tickUrl = `${appUrl}/api/internal/tick`;

logger.info(
  { tickUrl, intervalMs: INTERVAL_MS },
  "Starting local development background jobs worker...",
);

async function runTick(): Promise<void> {
  try {
    const res = await fetch(tickUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CRON_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.processed > 0) {
        logger.info(data, "Dev tick completed via HTTP endpoint");
      }
      return;
    }
  } catch {
    // If dev server HTTP endpoint is not reachable, execute directly via DB
  }

  try {
    await withTx(async (tx) => {
      await scheduleRecurringJobs(tx);
    });
    const result = await drainJobs(5);
    if (result.processed > 0) {
      logger.info(result, "Dev tick completed directly via DB");
    }
  } catch (err) {
    logger.error({ err }, "Direct dev tick execution error");
  }
}

// Run immediately then loop every 5 seconds
void (async () => {
  while (true) {
    await runTick();
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
})();
