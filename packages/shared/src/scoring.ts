import { FEED_HEALTH_LEVELS, LEVELS, NSFW_THRESHOLDS } from './constants';
import type { ClassificationResult, FeedHealthLevel, Streak } from './types';

/**
 * Calculate feed score from classification results.
 * Score is 0-100 where 0 = perfectly clean, 100 = fully suggestive.
 */
export function calculateFeedScore(classifications: ClassificationResult[]): number {
  if (classifications.length === 0) return 0;

  const suggestiveCount = classifications.filter(
    (c) =>
      (NSFW_THRESHOLDS.suggestiveCategories as readonly string[]).includes(c.category) &&
      c.confidence >= NSFW_THRESHOLDS.suggestive
  ).length;

  return Math.round((suggestiveCount / classifications.length) * 100);
}

/**
 * Get feed health level from a score.
 */
export function getFeedHealthLevel(score: number): FeedHealthLevel {
  for (const level of FEED_HEALTH_LEVELS) {
    if (score <= level.maxScore) return level.level;
  }
  return 'polluted';
}

/**
 * Get display info for a feed health level.
 */
export function getFeedHealthInfo(score: number) {
  const level = getFeedHealthLevel(score);
  const info = FEED_HEALTH_LEVELS.find((l) => l.level === level)!;
  return { level: info.level, label: info.label, color: info.color, score };
}

/**
 * Calculate streak bonus points.
 */
export function getStreakBonus(streakDays: number): number {
  if (streakDays >= 30) return 200;
  if (streakDays >= 7) return 50;
  return 0;
}

/**
 * Check if streak is still active (last activity was yesterday or today).
 */
export function isStreakActive(lastActivityDate: string | null): boolean {
  if (!lastActivityDate) return false;

  const last = new Date(lastActivityDate);
  const now = new Date();

  // Normalize to date-only comparison
  const lastDay = new Date(last.getFullYear(), last.getMonth(), last.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = today.getTime() - lastDay.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays <= 1;
}

/**
 * Compute updated streak data after a task completion.
 * Call this on the client before sending to Supabase via updateStreak().
 *
 * Logic:
 * - First ever activity → streak = 1
 * - Already active today → just add points (don't re-increment streak)
 * - Last activity was yesterday → continue streak (+1)
 * - Last activity was older → reset streak to 1
 */
export function computeStreakUpdate(
  currentStreak: Streak | null,
  pointsEarned: number
): {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
  total_points: number;
} {
  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

  // First ever activity
  if (!currentStreak) {
    return {
      current_streak: 1,
      longest_streak: 1,
      last_activity_date: today,
      total_points: pointsEarned,
    };
  }

  const totalPoints = currentStreak.total_points + pointsEarned;

  // Already active today — just add points, don't increment streak
  if (currentStreak.last_activity_date === today) {
    return {
      current_streak: currentStreak.current_streak,
      longest_streak: currentStreak.longest_streak,
      last_activity_date: today,
      total_points: totalPoints,
    };
  }

  // Streak continues if last activity was yesterday (reuse isStreakActive)
  const streakContinues = isStreakActive(currentStreak.last_activity_date);
  const newStreak = streakContinues ? currentStreak.current_streak + 1 : 1;
  const longestStreak = Math.max(newStreak, currentStreak.longest_streak);

  return {
    current_streak: newStreak,
    longest_streak: longestStreak,
    last_activity_date: today,
    total_points: totalPoints,
  };
}

/**
 * Get the user's level based on total points.
 * Returns current level info and progress toward the next level.
 */
export function getLevel(totalPoints: number): {
  level: number;
  label: string;
  currentPoints: number;
  nextLevelPoints: number | null;
  progress: number;
} {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const lvl of LEVELS) {
    if (totalPoints >= lvl.minPoints) current = lvl;
  }
  const nextLevel = LEVELS.find((l) => l.level === current.level + 1);
  const progress = nextLevel
    ? (totalPoints - current.minPoints) / (nextLevel.minPoints - current.minPoints)
    : 1;
  return {
    level: current.level,
    label: current.label,
    currentPoints: totalPoints,
    nextLevelPoints: nextLevel?.minPoints ?? null,
    progress: Math.min(progress, 1),
  };
}
