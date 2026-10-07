/**
 * Intervals logic for video watched segments.
 * Computes monotonic merged intervals and prevents completion via seeking.
 */

export type Interval = [number, number];

/**
 * Merges overlapping or adjacent intervals into a minimal list of disjoint intervals.
 * All interval boundaries are clamped to non-negative numbers and sorted.
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  // 1. Normalize intervals (ensure start <= end, non-negative, finite numbers)
  const normalized: Interval[] = [];
  for (const [start, end] of intervals) {
    if (Number.isFinite(start) && Number.isFinite(end)) {
      const s = Math.max(0, Math.min(start, end));
      const e = Math.max(0, Math.max(start, end));
      if (e > s) {
        normalized.push([s, e]);
      }
    }
  }

  if (normalized.length === 0) return [];

  // 2. Sort by start ascending, then end ascending
  normalized.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // 3. Merge
  const first = normalized[0];
  if (!first) return [];
  const merged: Interval[] = [[first[0], first[1]]];

  for (let i = 1; i < normalized.length; i++) {
    const current = normalized[i];
    const last = merged[merged.length - 1];

    if (!current || !last) continue;

    if (current[0] <= last[1]) {
      // Overlapping or adjacent: extend current interval
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push([current[0], current[1]]);
    }
  }

  return merged;
}

/**
 * Calculates the total length (unique seconds) covered by a set of intervals.
 */
export function calculateCoverage(intervals: Interval[]): number {
  const merged = mergeIntervals(intervals);
  return merged.reduce((acc, [start, end]) => acc + (end - start), 0);
}

/**
 * Computes updated watched intervals, progress percentage, and whether completion threshold is met.
 * Requirement: Video completion requires at least 90% of unique seconds watched.
 */
export function calculateVideoProgress(
  durationSeconds: number,
  existingWatched: Interval[],
  newSegments: Interval[],
): {
  merged: Interval[];
  coverageSeconds: number;
  progressPct: number;
  isCompleted: boolean;
} {
  if (durationSeconds <= 0) {
    return {
      merged: [],
      coverageSeconds: 0,
      progressPct: 100,
      isCompleted: true,
    };
  }

  // Merge existing intervals with newly reported segments
  const combined = [...existingWatched, ...newSegments];
  const merged = mergeIntervals(combined);
  const coverageSeconds = calculateCoverage(merged);

  const rawPct = Math.floor((coverageSeconds / durationSeconds) * 100);
  const progressPct = Math.min(100, Math.max(0, rawPct));
  const isCompleted = progressPct >= 90;

  return {
    merged,
    coverageSeconds,
    progressPct,
    isCompleted,
  };
}
