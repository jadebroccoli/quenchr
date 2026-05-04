import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { useCleanupStore } from '../stores/cleanup-store';
import { useSubscriptionStore } from '../stores/subscription-store';
import {
  getTodayChallenges,
  getAllChallenges,
  assignDailyChallenges,
} from '@quenchr/supabase-client';
import { selectDailyChallenges } from '@quenchr/shared';
import type { Challenge, UserChallenge } from '@quenchr/shared';

/**
 * Fetches today's challenges from Supabase and auto-assigns new ones if none exist.
 * Uses the cleanup store's challenges state for data sharing across tabs.
 *
 * Returns { loading, error, refetch } for the consuming screen to render loading/error states.
 */
export function useChallengesInit() {
  const user = useAuthStore((s) => s.user);
  const isPro = useSubscriptionStore((s) => s.proAccess);
  const limits = useSubscriptionStore((s) => s.limits);
  const setChallenges = useCleanupStore((s) => s.setChallenges);

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

        // 1. Try to fetch today's challenges
        const { data: existing } = await getTodayChallenges(user.id);
        if (cancelled) return;

        if (existing && existing.length > 0) {
          setChallenges(existing as unknown as (UserChallenge & { challenge: Challenge })[]);
          return;
        }

        // 2. No challenges for today — auto-assign
        const { data: allTemplates } = await getAllChallenges(isPro);
        if (cancelled) return;

        if (!allTemplates || allTemplates.length === 0) {
          setChallenges([]);
          return;
        }

        const count = limits.challengesPerDay;
        const selected = selectDailyChallenges(
          allTemplates as Challenge[],
          typeof count === 'number' && isFinite(count) ? count : 3,
          ['instagram', 'tiktok'], // user's active platforms (hardcoded for MVP)
        );

        // 3. Assign to Supabase
        const { error: assignErr } = await assignDailyChallenges(
          user.id,
          selected.map((c) => c.id)
        );
        if (assignErr) throw assignErr;
        if (cancelled) return;

        // 4. Re-fetch with joined challenge template data
        const { data: assigned } = await getTodayChallenges(user.id);
        if (cancelled) return;
        setChallenges((assigned ?? []) as unknown as (UserChallenge & { challenge: Challenge })[]);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load challenges'
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
