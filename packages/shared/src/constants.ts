import type { FeedHealthLevel, Platform } from './types';

export const PLATFORMS: Record<Platform, { label: string; color: string; icon: string }> = {
  instagram: { label: 'Instagram', color: '#E1306C', icon: 'instagram' },
  tiktok: { label: 'TikTok', color: '#000000', icon: 'tiktok' },
  twitter: { label: 'X (Twitter)', color: '#1DA1F2', icon: 'twitter' },
  reddit: { label: 'Reddit', color: '#FF4500', icon: 'reddit' },
  youtube: { label: 'YouTube', color: '#FF0000', icon: 'youtube' },
};

export const FEED_HEALTH_LEVELS: { level: FeedHealthLevel; label: string; maxScore: number; color: string }[] = [
  { level: 'pure_feed',      label: 'Pure Feed',      maxScore: 10,  color: '#4E7A3E' },
  { level: 'almost_clean',   label: 'Almost Clean',   maxScore: 25,  color: '#7A9B3E' },
  { level: 'getting_better', label: 'Getting Better', maxScore: 45,  color: '#C4922A' },
  { level: 'cleaning_up',    label: 'Cleaning Up',    maxScore: 65,  color: '#C4652A' },
  { level: 'polluted',       label: 'Polluted',       maxScore: 100, color: '#B83F3F' },
];

export const FREE_TIER_LIMITS = {
  platforms: 1,
  auditsPerWeek: 1,
  tasksPerDay: 3,
  challengesPerDay: 1,
  feedScoreHistory: 3,
  hasExtension: false,
  hasLeaderboard: false,
  hasAIInsights: false,
} as const;

export const PRO_TIER_LIMITS = {
  platforms: 5,
  auditsPerWeek: Infinity,
  tasksPerDay: Infinity,
  challengesPerDay: 3,
  feedScoreHistory: Infinity,
  hasExtension: true,
  hasLeaderboard: true,
  hasAIInsights: true,
} as const;

// AI Insights (Phase 2C)
export const AI_INSIGHTS_CONFIG = {
  /** Only send frames with suggestive_percentage above this threshold */
  suggestiveThreshold: 30,
  /** Maximum frames to send per analysis to control cost/latency */
  maxFrames: 5,
  /** Image resize width for base64 conversion */
  imageWidth: 480,
  /** JPEG compression quality for base64 conversion */
  imageQuality: 0.7,
} as const;

// NSFW detection thresholds
export const NSFW_THRESHOLDS = {
  /** Confidence threshold to flag as suggestive (single top prediction) */
  suggestive: 0.2,
  /** Lower threshold for 'sexy' category specifically (catches more thirst traps) */
  suggestiveSexy: 0.15,
  /** Combined confidence threshold — if sum of suggestive categories across predictions exceeds this, flag it */
  suggestiveCombined: 0.3,
  /** Combined threshold when 'drawing' category absorbs suggestive confidence */
  drawingCombined: 0.35,
  /** Categories considered suggestive */
  suggestiveCategories: ['porn', 'hentai', 'sexy'] as const,
  /** Grid size for splitting screenshots into regions */
  gridColumns: 3,
  gridRows: 4,
} as const;

// Gamification
export const POINTS = {
  taskComplete: 10,
  challengeComplete: 25,
  auditComplete: 15,
  streakBonus7: 50,
  streakBonus30: 200,
} as const;

export const BADGES = [
  { id: 'first_audit', label: 'First Audit', description: 'Complete your first feed audit', icon: '🔍' },
  { id: 'streak_7', label: '7-Day Streak', description: 'Maintain a 7-day cleanup streak', icon: '🔥' },
  { id: 'streak_30', label: '30-Day Streak', description: 'Maintain a 30-day cleanup streak', icon: '💪' },
  { id: 'score_under_20', label: 'Clean Feed', description: 'Get your feed score under 20', icon: '✨' },
  { id: 'score_under_5', label: 'Pure Feed', description: 'Get your feed score under 5', icon: '🏆' },
  { id: 'tasks_50', label: 'Dedicated', description: 'Complete 50 cleanup tasks', icon: '⭐' },
  { id: 'platform_mastered', label: 'Platform Mastered', description: 'Score under 10 on any platform', icon: '🎯' },
] as const;

export const LEVELS = [
  { level: 1, label: 'Pilgrim',  subtext: 'Seeking help, are you? Your journey to a goon-free feed starts here.', minPoints: 0 },
  { level: 2, label: 'Acolyte',  subtext: "You've lit your first candle. Small progress, but the algorithm noticed.", minPoints: 100 },
  { level: 3, label: 'Brother',  subtext: 'A monk in training. The flesh is weak, but the unfollow button is strong.', minPoints: 300 },
  { level: 4, label: 'Priest',   subtext: "You've taken your vows. Your feed trembles before your righteousness.", minPoints: 600 },
  { level: 5, label: 'Saint',    subtext: "You've ascended above all mortal desires on your feed. Exemplary.", minPoints: 1000 },
] as const;
