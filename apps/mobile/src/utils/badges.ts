import type { FeedAudit } from '@quenchr/shared';
import { computeCleanStreak } from './scanStreak';

// ── Types ──

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  emoji: string; // shown until real badge art is added
}

// ── Badge definitions ──

export const BADGES: BadgeDef[] = [
  {
    id: 'first_look',
    name: 'First Look',
    description: 'Completed your first feed audit.',
    emoji: '🔍',
  },
  {
    id: 'first_green',
    name: 'First Green',
    description: 'Scored under 25 for the first time.',
    emoji: '🌱',
  },
  {
    id: 'consistent',
    name: 'Consistent',
    description: 'Completed 3 audits in the last 30 days.',
    emoji: '🎯',
  },
  {
    id: 'dual_platform',
    name: 'Both Barrels',
    description: 'Scanned both Instagram and TikTok.',
    emoji: '📱',
  },
  {
    id: 'oasis_found',
    name: 'Oasis Found',
    description: 'Reached a score of 29 or below.',
    emoji: '🌴',
  },
  {
    id: 'one_month',
    name: 'One Month Clean',
    description: 'Kept a clean score for 4 consecutive weeks.',
    emoji: '📅',
  },
  {
    id: 'quenched',
    name: 'Quenched',
    description: 'Reached a score of 14 or below.',
    emoji: '💧',
  },
  {
    id: 'perfect',
    name: 'Perfect Score',
    description: 'Scored 10 or under on a scan.',
    emoji: '🏆',
  },
];

// ── Unlock logic ──

export function computeUnlockedBadges(audits: FeedAudit[]): Set<string> {
  const unlocked = new Set<string>();
  if (!audits.length) return unlocked;

  unlocked.add('first_look');

  const bestScore = Math.min(...audits.map((a) => a.feed_score));
  const platforms = new Set(audits.map((a) => a.platform));
  const { current, longest } = computeCleanStreak(audits);
  const maxStreak = Math.max(current, longest);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentCount = audits.filter(
    (a) => new Date(a.created_at) >= thirtyDaysAgo,
  ).length;

  if (bestScore <= 25) unlocked.add('first_green');
  if (bestScore <= 29) unlocked.add('oasis_found');
  if (bestScore <= 14) unlocked.add('quenched');
  if (bestScore <= 10) unlocked.add('perfect');
  if (maxStreak >= 4) unlocked.add('one_month');
  if (recentCount >= 3) unlocked.add('consistent');
  if (platforms.has('instagram') && platforms.has('tiktok')) unlocked.add('dual_platform');

  return unlocked;
}
