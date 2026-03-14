import type { Challenge, ChallengeActionType, Platform } from './types';

export interface ChallengeTemplate {
  title: string;
  description: string;
  platform: Platform | null;
  action_type: ChallengeActionType;
  target_count: number;
  points: number;
  is_premium: boolean;
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  // Instagram challenges
  {
    title: 'Explore Cleanup',
    description: 'Long-press and tap "Not Interested" on 5 suggestive posts in your Explore page.',
    platform: 'instagram',
    action_type: 'not_interested',
    target_count: 5,
    points: 25,
    is_premium: false,
  },
  {
    title: 'Unfollow Sweep',
    description: 'Review your Following list and unfollow 5 accounts that post suggestive content.',
    platform: 'instagram',
    action_type: 'unfollow',
    target_count: 5,
    points: 30,
    is_premium: false,
  },
  {
    title: 'Content Settings',
    description: 'Go to Settings → Suggested Content and set Sensitive Content to "Less".',
    platform: 'instagram',
    action_type: 'settings',
    target_count: 1,
    points: 20,
    is_premium: false,
  },
  {
    title: 'Search History Purge',
    description: 'Clear your Instagram search history to reset search-based recommendations.',
    platform: 'instagram',
    action_type: 'settings',
    target_count: 1,
    points: 15,
    is_premium: false,
  },
  {
    title: 'Saved Posts Review',
    description: 'Review your Saved posts and unsave any suggestive content to clean your signals.',
    platform: 'instagram',
    action_type: 'not_interested',
    target_count: 10,
    points: 35,
    is_premium: true,
  },

  // TikTok challenges
  {
    title: 'FYP Cleanse',
    description: 'Long-press and tap "Not Interested" on 5 suggestive FYP videos.',
    platform: 'tiktok',
    action_type: 'not_interested',
    target_count: 5,
    points: 25,
    is_premium: false,
  },
  {
    title: 'Creator Cleanup',
    description: 'Unfollow 5 creators who primarily post suggestive content.',
    platform: 'tiktok',
    action_type: 'unfollow',
    target_count: 5,
    points: 30,
    is_premium: false,
  },
  {
    title: 'Keyword Filter',
    description: 'Add keywords to your TikTok content filter (Settings → Content Preferences → Filter).',
    platform: 'tiktok',
    action_type: 'settings',
    target_count: 1,
    points: 20,
    is_premium: false,
  },
  {
    title: 'Cache Clear',
    description: 'Clear your TikTok cache and watch history to reset recommendations.',
    platform: 'tiktok',
    action_type: 'settings',
    target_count: 1,
    points: 15,
    is_premium: false,
  },

  // Cross-platform challenges
  {
    title: 'Feed Audit Challenge',
    description: 'Do a new Feed Audit and try to beat your previous score.',
    platform: null,
    action_type: 'audit',
    target_count: 1,
    points: 20,
    is_premium: false,
  },
  {
    title: 'Deep Clean',
    description: 'Complete 10 cleanup tasks in a single day.',
    platform: null,
    action_type: 'not_interested',
    target_count: 10,
    points: 50,
    is_premium: true,
  },
];

/**
 * Pick N random challenges from the pool for daily assignment.
 * Prefers challenges matching user's active platforms.
 */
export function selectDailyChallenges(
  allChallenges: Challenge[],
  count: number,
  userPlatforms?: string[],
): Challenge[] {
  let pool = [...allChallenges];

  // Prefer platform-specific challenges the user actually uses
  if (userPlatforms && userPlatforms.length > 0) {
    const platformSpecific = pool.filter(
      (c) => c.platform === null || userPlatforms.includes(c.platform)
    );
    if (platformSpecific.length >= count) {
      pool = platformSpecific;
    }
  }

  // Shuffle (Fisher-Yates) and take first N
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}
