import type { FeedAudit } from '@quenchr/shared';

/** Score at or below this = a "clean" scan week */
export const CLEAN_SCORE_THRESHOLD = 30;

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns a Monday-based week bucket number (weeks since Unix epoch).
 * Two dates in the same Mon–Sun window return the same bucket.
 */
function getWeekBucket(date: Date): number {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const daysToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + daysToMonday);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / MS_PER_WEEK);
}

/**
 * Compute current + longest clean scan streak from audit history.
 *
 * A "clean week" = at least one scan that week with feed_score ≤ CLEAN_SCORE_THRESHOLD.
 * A gap week (no scan at all) breaks the current streak but is ignored for longest.
 */
export function computeCleanStreak(audits: FeedAudit[]): {
  current: number;
  longest: number;
} {
  if (!audits.length) return { current: 0, longest: 0 };

  // Build: weekBucket → best (lowest) score that week
  const weekBest = new Map<number, number>();
  for (const a of audits) {
    const bucket = getWeekBucket(new Date(a.created_at));
    const prev = weekBest.get(bucket) ?? Infinity;
    if (a.feed_score < prev) weekBest.set(bucket, a.feed_score);
  }

  const currentBucket = getWeekBucket(new Date());

  // ── Current streak ──
  // Walk backwards from the current week; stop on gap or unclean week.
  let current = 0;
  for (let b = currentBucket; b >= currentBucket - 104; b--) {
    const best = weekBest.get(b);
    if (best === undefined) break;           // no scan = streak ends
    if (best > CLEAN_SCORE_THRESHOLD) break; // not clean = streak ends
    current++;
  }

  // ── Longest streak ──
  const allBuckets = Array.from(weekBest.keys()).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev: number | null = null;

  for (const b of allBuckets) {
    const isConsecutive = prev === null || b === prev + 1;
    const isClean = (weekBest.get(b) ?? Infinity) <= CLEAN_SCORE_THRESHOLD;

    if (isConsecutive && isClean) {
      run++;
    } else {
      run = isClean ? 1 : 0;
    }

    if (run > longest) longest = run;
    prev = b;
  }

  return { current, longest };
}
