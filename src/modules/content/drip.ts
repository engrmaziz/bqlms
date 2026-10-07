import type { DripRule } from "./schema";

export interface DripAccessResult {
  unlocked: boolean;
  reason?: string | undefined;
  unlocksAt?: Date | undefined;
}

export interface DripEvaluationContext {
  currentTime: Date;
  timezone: string;
  isInstructor?: boolean | undefined;
  overrideUnlockedAt?: Date | null | undefined;
  enrollmentDate?: Date | null | undefined;
  termStartDate?: Date | string | null | undefined;
  completedLessonIds?: Iterable<string> | undefined;
  assessmentScores?: Record<string, number> | Map<string, number> | undefined;
}

/**
 * Parses a date or string into [year, month, day] numbers.
 */
function parseDateParts(d: Date | string): {
  year: number;
  month: number;
  day: number;
} {
  if (typeof d === "string") {
    // If format is YYYY-MM-DD
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }
  }
  const dateObj = typeof d === "string" ? new Date(d) : d;
  return {
    year: dateObj.getUTCFullYear(),
    month: dateObj.getUTCMonth() + 1,
    day: dateObj.getUTCDate(),
  };
}

/**
 * Computes the exact UTC Date corresponding to midnight (00:00:00) on
 * (baseDate + days) in the specified IANA timezone.
 * Accurately accounts for Daylight Saving Time (DST) changes.
 */
export function getMidnightInTimezone(
  baseDate: Date | string,
  daysToAdd: number,
  timezone: string,
): Date {
  const parts = parseDateParts(baseDate);

  // 1. Calculate target calendar day in UTC year/month/day
  const targetUtc = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + daysToAdd, 12, 0, 0),
  );
  const targetYear = targetUtc.getUTCFullYear();
  const targetMonth = targetUtc.getUTCMonth() + 1;
  const targetDay = targetUtc.getUTCDate();

  // 2. Find the UTC instant where the target timezone is 00:00:00 on (targetYear, targetMonth, targetDay)
  // Start with an approximation near UTC midnight
  let candidate = new Date(
    Date.UTC(targetYear, targetMonth - 1, targetDay, 0, 0, 0),
  );

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  // Iteratively adjust offset to converge on midnight local time (converges in 1-2 steps)
  for (let step = 0; step < 5; step++) {
    const formatted = formatter.formatToParts(candidate);
    const partMap: Record<string, number> = {};
    for (const p of formatted) {
      if (p.type !== "literal") {
        partMap[p.type] = Number(p.value);
      }
    }

    const cYear = partMap.year ?? targetYear;
    const cMonth = partMap.month ?? targetMonth;
    const cDay = partMap.day ?? targetDay;
    let cHour = partMap.hour ?? 0;
    if (cHour === 24) cHour = 0;
    const cMin = partMap.minute ?? 0;
    const cSec = partMap.second ?? 0;

    // Difference in milliseconds between local candidate time and desired target midnight
    // Desired: targetYear, targetMonth, targetDay at 00:00:00
    const desiredLocalMs = Date.UTC(
      targetYear,
      targetMonth - 1,
      targetDay,
      0,
      0,
      0,
    );
    const actualLocalMs = Date.UTC(cYear, cMonth - 1, cDay, cHour, cMin, cSec);
    const diffMs = desiredLocalMs - actualLocalMs;

    if (diffMs === 0) {
      break;
    }
    candidate = new Date(candidate.getTime() + diffMs);
  }

  return candidate;
}

/**
 * Pure function: evaluates whether content is accessible based on drip rules and context.
 * Rules are combined with logical AND.
 */
export function evaluateAccess(
  rules: DripRule[],
  ctx: DripEvaluationContext,
): DripAccessResult {
  // 1. Instructors bypass all drip rules
  if (ctx.isInstructor) {
    return { unlocked: true };
  }

  // 2. Student accommodation override
  if (ctx.overrideUnlockedAt) {
    const overrideDate = new Date(ctx.overrideUnlockedAt);
    if (ctx.currentTime >= overrideDate) {
      return { unlocked: true };
    }
  }

  // 3. No rules means unlocked immediately
  if (!rules || rules.length === 0) {
    return { unlocked: true };
  }

  const completedSet = new Set(ctx.completedLessonIds || []);
  const scoresMap: Record<string, number> =
    ctx.assessmentScores instanceof Map
      ? Object.fromEntries(ctx.assessmentScores)
      : ctx.assessmentScores || {};

  let isUnlocked = true;
  let latestUnlockDate: Date | undefined;
  const failureReasons: string[] = [];

  for (const rule of rules) {
    switch (rule.kind) {
      case "fixed_date": {
        const unlockDate = new Date(rule.date);
        if (ctx.currentTime < unlockDate) {
          isUnlocked = false;
          failureReasons.push(
            `Available on ${unlockDate.toLocaleDateString("en-US", {
              timeZone: ctx.timezone,
              month: "short",
              day: "numeric",
              year: "numeric",
            })}`,
          );
          if (!latestUnlockDate || unlockDate > latestUnlockDate) {
            latestUnlockDate = unlockDate;
          }
        }
        break;
      }

      case "relative_to_enrollment": {
        if (!ctx.enrollmentDate) {
          isUnlocked = false;
          failureReasons.push("Requires active enrollment");
          break;
        }
        const enrollTime = new Date(ctx.enrollmentDate).getTime();
        const unlockTime = enrollTime + rule.days * 86_400_000;
        const unlockDate = new Date(unlockTime);

        if (ctx.currentTime.getTime() < unlockTime) {
          isUnlocked = false;
          failureReasons.push(`Available ${rule.days} days after enrollment`);
          if (!latestUnlockDate || unlockDate > latestUnlockDate) {
            latestUnlockDate = unlockDate;
          }
        }
        break;
      }

      case "relative_to_term_start": {
        if (!ctx.termStartDate) {
          isUnlocked = false;
          failureReasons.push("Requires term schedule");
          break;
        }

        const unlockDate = getMidnightInTimezone(
          ctx.termStartDate,
          rule.days,
          ctx.timezone,
        );

        if (ctx.currentTime < unlockDate) {
          isUnlocked = false;
          failureReasons.push(
            `Available ${rule.days} days after term start (${unlockDate.toLocaleDateString("en-US", { timeZone: ctx.timezone, month: "short", day: "numeric" })})`,
          );
          if (!latestUnlockDate || unlockDate > latestUnlockDate) {
            latestUnlockDate = unlockDate;
          }
        }
        break;
      }

      case "after_completion": {
        if (rule.lessonIds.length > 0) {
          if (rule.require === "any") {
            const hasAny = rule.lessonIds.some((id) => completedSet.has(id));
            if (!hasAny) {
              isUnlocked = false;
              failureReasons.push("Prerequisites not completed");
            }
          } else {
            // default "all"
            const hasAll = rule.lessonIds.every((id) => completedSet.has(id));
            if (!hasAll) {
              isUnlocked = false;
              failureReasons.push("All prerequisite lessons must be completed");
            }
          }
        }
        break;
      }

      case "min_score": {
        const score = scoresMap[rule.assessmentId] ?? 0;
        if (score < rule.pct) {
          isUnlocked = false;
          failureReasons.push(
            `Requires minimum score of ${rule.pct}% on previous assessment`,
          );
        }
        break;
      }
    }
  }

  // If student has an override with future unlock date, it might provide an earlier unlock date
  if (ctx.overrideUnlockedAt && latestUnlockDate) {
    const overrideDate = new Date(ctx.overrideUnlockedAt);
    if (overrideDate < latestUnlockDate) {
      latestUnlockDate = overrideDate;
    }
  }

  return {
    unlocked: isUnlocked,
    reason: isUnlocked ? undefined : failureReasons[0],
    unlocksAt: isUnlocked ? undefined : latestUnlockDate,
  };
}

/**
 * Validates prerequisite graph across lessons to detect and prevent cycles.
 * Returns { valid: true } or { valid: false, cycle: ['id1', 'id2', ...] }.
 */
export function validatePrerequisiteGraph(
  lessonsWithPrereqs: { id: string; prerequisiteIds: string[] }[],
): { valid: boolean; cycle?: string[] } {
  const adj = new Map<string, string[]>();
  for (const { id, prerequisiteIds } of lessonsWithPrereqs) {
    adj.set(id, prerequisiteIds || []);
  }

  const visited = new Map<string, "visiting" | "visited">();
  const path: string[] = [];

  function dfs(node: string): string[] | null {
    visited.set(node, "visiting");
    path.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      const state = visited.get(neighbor);
      if (state === "visiting") {
        // Cycle detected
        const cycleStartIndex = path.indexOf(neighbor);
        return path.slice(cycleStartIndex).concat(neighbor);
      }
      if (!state) {
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      }
    }

    path.pop();
    visited.set(node, "visited");
    return null;
  }

  for (const { id } of lessonsWithPrereqs) {
    if (!visited.has(id)) {
      const cycle = dfs(id);
      if (cycle) {
        return { valid: false, cycle };
      }
    }
  }

  return { valid: true };
}
