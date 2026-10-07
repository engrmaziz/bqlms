import { describe, expect, it } from "vitest";
import {
  evaluateAccess,
  getMidnightInTimezone,
  validatePrerequisiteGraph,
} from "../drip";
import type { DripRule } from "../schema";

describe("Content Drip Evaluation", () => {
  const baseContext = {
    currentTime: new Date("2026-04-01T12:00:00Z"),
    timezone: "America/New_York",
  };

  it("always allows access to instructors regardless of rules", () => {
    const rules: DripRule[] = [
      { kind: "fixed_date", date: "2099-01-01T00:00:00Z" },
      { kind: "after_completion", lessonIds: ["lesson-99"], require: "all" },
    ];
    const res = evaluateAccess(rules, {
      ...baseContext,
      isInstructor: true,
    });
    expect(res.unlocked).toBe(true);
  });

  it("unlocks content immediately if there are no rules", () => {
    const res = evaluateAccess([], baseContext);
    expect(res.unlocked).toBe(true);
  });

  it("unlocks content if an accommodation override timestamp is in the past", () => {
    const rules: DripRule[] = [
      { kind: "fixed_date", date: "2099-01-01T00:00:00Z" },
    ];
    const res = evaluateAccess(rules, {
      ...baseContext,
      overrideUnlockedAt: new Date("2026-03-31T00:00:00Z"),
    });
    expect(res.unlocked).toBe(true);
  });

  describe("Fixed Date Rules", () => {
    it("locks content before the fixed date and provides unlocksAt", () => {
      const unlockDate = new Date("2026-04-05T00:00:00Z");
      const rules: DripRule[] = [
        { kind: "fixed_date", date: unlockDate.toISOString() },
      ];
      const res = evaluateAccess(rules, baseContext);
      expect(res.unlocked).toBe(false);
      expect(res.unlocksAt).toEqual(unlockDate);
      expect(res.reason).toContain("Available on");
    });

    it("unlocks content at or after the fixed date", () => {
      const unlockDate = new Date("2026-03-25T00:00:00Z");
      const rules: DripRule[] = [
        { kind: "fixed_date", date: unlockDate.toISOString() },
      ];
      const res = evaluateAccess(rules, baseContext);
      expect(res.unlocked).toBe(true);
    });
  });

  describe("Relative to Enrollment Rules", () => {
    it("locks content if student is not yet enrolled", () => {
      const rules: DripRule[] = [{ kind: "relative_to_enrollment", days: 3 }];
      const res = evaluateAccess(rules, {
        ...baseContext,
        enrollmentDate: null,
      });
      expect(res.unlocked).toBe(false);
      expect(res.reason).toContain("Requires active enrollment");
    });

    it("evaluates unlock based on enrollment date + days", () => {
      const enrollmentDate = new Date("2026-04-01T00:00:00Z");
      const rules: DripRule[] = [{ kind: "relative_to_enrollment", days: 2 }];

      // Day 0: 12 hours after enrollment -> locked
      const res1 = evaluateAccess(rules, {
        ...baseContext,
        currentTime: new Date("2026-04-01T12:00:00Z"),
        enrollmentDate,
      });
      expect(res1.unlocked).toBe(false);
      expect(res1.unlocksAt).toEqual(new Date("2026-04-03T00:00:00Z"));

      // Day 2: exactly 48 hours after enrollment -> unlocked
      const res2 = evaluateAccess(rules, {
        ...baseContext,
        currentTime: new Date("2026-04-03T00:00:00Z"),
        enrollmentDate,
      });
      expect(res2.unlocked).toBe(true);
    });
  });

  describe("DST Boundary Handling in College Timezone", () => {
    const tz = "America/New_York";

    // In 2026:
    // Spring forward occurs on Sunday, March 8, 2026 (UTC-5 -> UTC-4).
    // Before March 8: Standard Time (EST = UTC-5). Midnight EST is 05:00 UTC.
    // On/After March 8: Daylight Time (EDT = UTC-4). Midnight EDT is 04:00 UTC.

    it("correctly identifies midnight UTC before Spring Forward transition", () => {
      // 5 days from March 1, 2026 -> March 6, 2026 in America/New_York
      const midnight = getMidnightInTimezone("2026-03-01", 5, tz);
      // March 6 00:00:00 EST corresponds to 2026-03-06 05:00:00 UTC
      expect(midnight.toISOString()).toBe("2026-03-06T05:00:00.000Z");
    });

    it("correctly crosses the Spring Forward DST boundary to calculate midnight EDT", () => {
      // 9 days from March 1, 2026 -> March 10, 2026 in America/New_York
      const midnight = getMidnightInTimezone("2026-03-01", 9, tz);
      // March 10 00:00:00 EDT corresponds to 2026-03-10 04:00:00 UTC (1 hour shift!)
      expect(midnight.toISOString()).toBe("2026-03-10T04:00:00.000Z");
    });

    it("evaluates relative_to_term_start across DST boundary accurately", () => {
      const termStartDate = "2026-03-01";
      const rules: DripRule[] = [
        { kind: "relative_to_term_start", days: 9 }, // Target: March 10 00:00 EDT (04:00 UTC)
      ];

      // Just before midnight EDT: March 10 at 03:59:59 UTC -> locked
      const before = evaluateAccess(rules, {
        currentTime: new Date("2026-03-10T03:59:59Z"),
        timezone: tz,
        termStartDate,
      });
      expect(before.unlocked).toBe(false);
      expect(before.unlocksAt?.toISOString()).toBe("2026-03-10T04:00:00.000Z");

      // Exactly at midnight EDT: March 10 at 04:00:00 UTC -> unlocked
      const atMidnight = evaluateAccess(rules, {
        currentTime: new Date("2026-03-10T04:00:00Z"),
        timezone: tz,
        termStartDate,
      });
      expect(atMidnight.unlocked).toBe(true);
    });
  });

  describe("Prerequisites and Min Score Rules", () => {
    it("handles after_completion require: all", () => {
      const rules: DripRule[] = [
        {
          kind: "after_completion",
          lessonIds: ["lesson-1", "lesson-2"],
          require: "all",
        },
      ];

      // Only one completed -> locked
      const partial = evaluateAccess(rules, {
        ...baseContext,
        completedLessonIds: ["lesson-1"],
      });
      expect(partial.unlocked).toBe(false);

      // Both completed -> unlocked
      const complete = evaluateAccess(rules, {
        ...baseContext,
        completedLessonIds: ["lesson-1", "lesson-2"],
      });
      expect(complete.unlocked).toBe(true);
    });

    it("handles after_completion require: any", () => {
      const rules: DripRule[] = [
        {
          kind: "after_completion",
          lessonIds: ["lesson-1", "lesson-2"],
          require: "any",
        },
      ];

      // None completed -> locked
      const none = evaluateAccess(rules, {
        ...baseContext,
        completedLessonIds: [],
      });
      expect(none.unlocked).toBe(false);

      // One completed -> unlocked
      const one = evaluateAccess(rules, {
        ...baseContext,
        completedLessonIds: ["lesson-2"],
      });
      expect(one.unlocked).toBe(true);
    });

    it("handles min_score rule", () => {
      const rules: DripRule[] = [
        { kind: "min_score", assessmentId: "quiz-1", pct: 80 },
      ];

      // Score 75% -> locked
      const failing = evaluateAccess(rules, {
        ...baseContext,
        assessmentScores: { "quiz-1": 75 },
      });
      expect(failing.unlocked).toBe(false);

      // Score 85% -> unlocked
      const passing = evaluateAccess(rules, {
        ...baseContext,
        assessmentScores: { "quiz-1": 85 },
      });
      expect(passing.unlocked).toBe(true);
    });

    it("combines multiple rules with logical AND", () => {
      const rules: DripRule[] = [
        { kind: "fixed_date", date: "2026-03-01T00:00:00Z" }, // passed
        { kind: "after_completion", lessonIds: ["l1"], require: "all" }, // passed
        { kind: "min_score", assessmentId: "q1", pct: 70 }, // failed
      ];

      const res = evaluateAccess(rules, {
        ...baseContext,
        completedLessonIds: ["l1"],
        assessmentScores: { q1: 65 },
      });
      expect(res.unlocked).toBe(false);
      expect(res.reason).toContain("70%");
    });
  });

  describe("Prerequisite Graph Cycle Detection", () => {
    it("accepts a valid acyclic dependency graph", () => {
      const graph = [
        { id: "lesson-3", prerequisiteIds: ["lesson-2"] },
        { id: "lesson-2", prerequisiteIds: ["lesson-1"] },
        { id: "lesson-1", prerequisiteIds: [] },
      ];
      const res = validatePrerequisiteGraph(graph);
      expect(res.valid).toBe(true);
    });

    it("rejects a direct cycle (A -> B -> A)", () => {
      const graph = [
        { id: "lesson-A", prerequisiteIds: ["lesson-B"] },
        { id: "lesson-B", prerequisiteIds: ["lesson-A"] },
      ];
      const res = validatePrerequisiteGraph(graph);
      expect(res.valid).toBe(false);
      expect(res.cycle).toBeDefined();
      expect(res.cycle?.length).toBeGreaterThanOrEqual(2);
    });

    it("rejects an indirect cycle (A -> B -> C -> A)", () => {
      const graph = [
        { id: "lesson-A", prerequisiteIds: ["lesson-B"] },
        { id: "lesson-B", prerequisiteIds: ["lesson-C"] },
        { id: "lesson-C", prerequisiteIds: ["lesson-A"] },
      ];
      const res = validatePrerequisiteGraph(graph);
      expect(res.valid).toBe(false);
      expect(res.cycle).toBeDefined();
    });
  });
});
