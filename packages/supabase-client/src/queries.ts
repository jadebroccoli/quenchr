import { supabase } from './client';
import type { Platform } from '@quenchr/shared';

// ── User ──

export async function getUser(userId: string) {
  return supabase.from('users').select('*').eq('id', userId).single();
}

export async function updateUser(userId: string, data: { display_name?: string; onboarding_complete?: boolean }) {
  return supabase.from('users').update(data).eq('id', userId);
}

// ── Platforms ──

export async function getUserPlatforms(userId: string) {
  return supabase.from('user_platforms').select('*').eq('user_id', userId).eq('active', true);
}

export async function addUserPlatform(userId: string, platform: Platform) {
  return supabase.from('user_platforms').upsert(
    { user_id: userId, platform, active: true },
    { onConflict: 'user_id,platform' }
  );
}

export async function removeUserPlatform(userId: string, platform: Platform) {
  return supabase.from('user_platforms').update({ active: false }).eq('user_id', userId).eq('platform', platform);
}

// ── Feed Audits ──

export async function createFeedAudit(data: {
  user_id: string;
  platform: string;
  total_scanned: number;
  nsfw_detected: number;
  sexy_detected: number;
  neutral_detected: number;
  feed_score: number;
  scan_type?: 'nsfwjs' | 'haiku';
}) {
  return supabase.from('feed_audits').insert(data).select().single();
}

export async function updateFeedAudit(
  auditId: string,
  data: {
    feed_score?: number;
    scan_type?: 'nsfwjs' | 'haiku';
    nsfw_detected?: number;
    sexy_detected?: number;
    neutral_detected?: number;
    total_scanned?: number;
  },
) {
  return supabase.from('feed_audits').update(data).eq('id', auditId).select().single();
}

export async function getFeedAudits(userId: string, platform?: Platform, limit = 10) {
  let query = supabase
    .from('feed_audits')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (platform) {
    query = query.eq('platform', platform);
  }

  return query;
}

export async function getLatestFeedAudit(userId: string, platform: Platform) {
  return supabase
    .from('feed_audits')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
}

// ── Cleanup Tasks ──

export async function getCleanupTasks(platform: Platform, includePremium = false) {
  let query = supabase.from('cleanup_tasks').select('*').eq('platform', platform);

  if (!includePremium) {
    query = query.eq('is_premium', false);
  }

  return query;
}

export async function getUserCleanupProgress(userId: string) {
  return supabase.from('user_cleanup_progress').select('*, cleanup_tasks(*)').eq('user_id', userId);
}

export async function completeCleanupTask(userId: string, taskId: string) {
  return supabase.from('user_cleanup_progress').upsert(
    {
      user_id: userId,
      task_id: taskId,
      completed: true,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,task_id' }
  );
}

export async function getTasksCompletedToday(userId: string) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return supabase
    .from('user_cleanup_progress')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true)
    .gte('completed_at', todayStart.toISOString());
}

// ── Streaks ──

export async function getStreak(userId: string) {
  return supabase.from('streaks').select('*').eq('user_id', userId).maybeSingle();
}

export async function updateStreak(userId: string, data: {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
  total_points: number;
}) {
  return supabase.from('streaks').upsert({ user_id: userId, ...data }, { onConflict: 'user_id' });
}

// ── Challenges ──

export async function getTodayChallenges(userId: string) {
  const today = new Date().toISOString().split('T')[0];
  return supabase
    .from('user_challenges')
    .select('*, challenge:challenges(*)')
    .eq('user_id', userId)
    .eq('assigned_date', today);
}

export async function updateChallengeProgress(userChallengeId: string, progress: number, completed: boolean) {
  return supabase.from('user_challenges').update({
    progress,
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  }).eq('id', userChallengeId);
}

export async function getAllChallenges(includePremium = false) {
  let query = supabase.from('challenges').select('*');
  if (!includePremium) {
    query = query.eq('is_premium', false);
  }
  return query;
}

export async function assignDailyChallenges(userId: string, challengeIds: string[]) {
  const today = new Date().toISOString().split('T')[0];
  const rows = challengeIds.map((id) => ({
    user_id: userId,
    challenge_id: id,
    progress: 0,
    completed: false,
    assigned_date: today,
  }));
  return supabase.from('user_challenges').insert(rows);
}

// ── AI Insights ──

export async function getAIInsights(auditId: string) {
  return supabase
    .from('ai_insights')
    .select('*')
    .eq('audit_id', auditId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
}

export async function getLatestAIInsights(userId: string, platform?: Platform) {
  let query = supabase
    .from('ai_insights')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (platform) {
    query = query.eq('platform', platform);
  }

  return query.single();
}
