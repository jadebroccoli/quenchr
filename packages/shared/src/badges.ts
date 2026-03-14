import { BADGES } from './constants';
import type { Streak, FeedAudit } from './types';

export interface BadgeEvalContext {
  streak: Streak | null;
  totalTasksCompleted: number;
  audits: FeedAudit[];
}

export interface BadgeStatus {
  id: string;
  label: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

/**
 * Evaluate all badges against user data and return unlock status.
 */
export function evaluateBadges(ctx: BadgeEvalContext): BadgeStatus[] {
  return BADGES.map((badge) => ({
    ...badge,
    unlocked: isBadgeUnlocked(badge.id, ctx),
  }));
}

function isBadgeUnlocked(badgeId: string, ctx: BadgeEvalContext): boolean {
  switch (badgeId) {
    case 'first_audit':
      return ctx.audits.length > 0;
    case 'streak_7':
      return (ctx.streak?.longest_streak ?? 0) >= 7;
    case 'streak_30':
      return (ctx.streak?.longest_streak ?? 0) >= 30;
    case 'score_under_20':
      return ctx.audits.some((a) => a.feed_score < 20);
    case 'score_under_5':
      return ctx.audits.some((a) => a.feed_score < 5);
    case 'tasks_50':
      return ctx.totalTasksCompleted >= 50;
    case 'platform_mastered':
      return ctx.audits.some((a) => a.feed_score < 10);
    default:
      return false;
  }
}
