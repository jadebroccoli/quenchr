import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { useCleanupStore } from '../stores/cleanup-store';
import { useSubscriptionStore } from '../stores/subscription-store';
import {
  getCleanupTasks,
  getUserCleanupProgress,
  getStreak,
  getTodayChallenges,
  getTasksCompletedToday,
} from '@quenchr/supabase-client';
import type { Platform, CleanupTask } from '@quenchr/shared';

/**
 * Fetches all cleanup-related data from Supabase on mount and hydrates the cleanup store.
 * Fires 6 queries in parallel — both platforms' tasks, progress, streak, challenges, daily count.
 *
 * Returns { loading, error, refetch } for the consuming screen to render loading/error states.
 */
export function useCleanupInit() {
  const user = useAuthStore((s) => s.user);
  const isPro = useSubscriptionStore((s) => s.isPro());
  const {
    setTasks,
    setProgress,
    setChallenges,
    setStreak,
    setTasksCompletedToday,
  } = useCleanupStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Fire all queries in parallel — 12 tasks total is a tiny payload
        const [igRes, tkRes, progressRes, streakRes, challengesRes, todayRes] =
          await Promise.all([
            getCleanupTasks('instagram' as Platform, isPro),
            getCleanupTasks('tiktok' as Platform, isPro),
            getUserCleanupProgress(user.id),
            getStreak(user.id),
            getTodayChallenges(user.id),
            getTasksCompletedToday(user.id),
          ]);

        if (cancelled) return;

        // Combine tasks from both platforms
        const allTasks: CleanupTask[] = [
          ...((igRes.data ?? []) as unknown as CleanupTask[]),
          ...((tkRes.data ?? []) as unknown as CleanupTask[]),
        ];

        setTasks(allTasks);
        setProgress((progressRes.data ?? []) as any);
        setStreak((streakRes.data as any) ?? null);
        setChallenges((challengesRes.data ?? []) as any);
        setTasksCompletedToday(todayRes.count ?? 0);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load cleanup data'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, isPro, trigger]);

  return { loading, error, refetch };
}
