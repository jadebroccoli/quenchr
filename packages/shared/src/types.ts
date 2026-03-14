export type Platform = 'instagram' | 'tiktok' | 'twitter' | 'reddit' | 'youtube';

export type SubscriptionTier = 'free' | 'pro';

export type TaskDifficulty = 'easy' | 'medium' | 'hard';

export type ChallengeActionType = 'unfollow' | 'not_interested' | 'settings' | 'audit';

export type NSFWCategory = 'porn' | 'hentai' | 'sexy' | 'drawing' | 'neutral';

export type FeedHealthLevel =
  | 'polluted'
  | 'cleaning_up'
  | 'getting_better'
  | 'almost_clean'
  | 'pure_feed';

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  subscription_tier: SubscriptionTier;
  onboarding_complete: boolean;
  created_at: string;
}

export interface UserPlatform {
  id: string;
  user_id: string;
  platform: Platform;
  active: boolean;
  added_at: string;
}

export interface FeedAudit {
  id: string;
  user_id: string;
  platform: Platform;
  total_scanned: number;
  nsfw_detected: number;
  sexy_detected: number;
  neutral_detected: number;
  feed_score: number;
  created_at: string;
}

export interface CleanupTask {
  id: string;
  platform: Platform;
  title: string;
  description: string;
  instruction_steps: InstructionStep[];
  deep_link: string | null;
  difficulty: TaskDifficulty;
  points: number;
  is_premium: boolean;
}

export interface InstructionStep {
  step: number;
  text: string;
  image_key?: string;
}

export interface UserCleanupProgress {
  id: string;
  user_id: string;
  task_id: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Streak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  total_points: number;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  platform: Platform | null;
  action_type: ChallengeActionType;
  target_count: number;
  points: number;
  is_premium: boolean;
}

export interface UserChallenge {
  id: string;
  user_id: string;
  challenge_id: string;
  progress: number;
  completed: boolean;
  assigned_date: string;
  completed_at: string | null;
}

export interface ClassificationResult {
  category: NSFWCategory;
  confidence: number;
}

export interface AuditImageResult {
  image_index: number;
  regions: RegionResult[];
  suggestive_percentage: number;
}

export interface RegionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  classification: ClassificationResult;
}

// ── Cleanup Session Types ──

export type CleanupPriority = 'critical' | 'high' | 'medium' | 'maintenance';

export type SessionPhase = 'not_started' | 'in_progress' | 'completed';

export interface CleanupSessionStep {
  task: CleanupTask;
  priority: CleanupPriority;
  reason: string;
  estimatedMinutes: number;
}

export interface CleanupSession {
  id: string;
  platform: Platform;
  steps: CleanupSessionStep[];
  currentStepIndex: number;
  phase: SessionPhase;
  totalPoints: number;
  earnedPoints: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AuditBreakdown {
  suggestivePercent: number;
  explicitPercent: number;
  sexyPercent: number;
  cleanPercent: number;
}

// ── AI Insights Types (Phase 2C) ──

export type ContentType =
  | 'thirst_trap'
  | 'fitness'
  | 'onlyfans_promo'
  | 'dating_ad'
  | 'swimwear_beach'
  | 'lingerie'
  | 'dance_trend'
  | 'provocative_selfie'
  | 'suggestive_meme'
  | 'other_suggestive';

export type AccountType =
  | 'influencer'
  | 'brand'
  | 'personal_friend'
  | 'provocative_creator'
  | 'dating_app'
  | 'fitness_account'
  | 'meme_page'
  | 'unknown';

export interface FrameInsight {
  frame_index: number;
  content_type: ContentType;
  is_false_positive: boolean;
  false_positive_reason: string | null;
  account_type: AccountType;
  description: string;
}

export interface AICleanupRecommendation {
  title: string;
  description: string;
  priority: number;
}

export interface AIInsightsResult {
  frame_insights: FrameInsight[];
  content_type_summary: Partial<Record<ContentType, number>>;
  account_type_summary: Partial<Record<AccountType, number>>;
  false_positive_count: number;
  adjusted_feed_score: number | null;
  recommendations: AICleanupRecommendation[];
  summary: string;
}

export type AIInsightsStatus = 'idle' | 'loading' | 'success' | 'error';
