import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_TIER_LIMITS, PRO_TIER_LIMITS } from '@quenchr/shared';
import type { SubscriptionTier } from '@quenchr/shared';

const TRIAL_KEY = '@quenchr:trialStartedAt';
const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function computeProAccess(devMode: boolean, tier: SubscriptionTier, trialStartedAt: string | null): boolean {
  if (devMode) return true;
  if (tier === 'pro') return true;
  if (tier === 'trial' && trialStartedAt) {
    return Date.now() - new Date(trialStartedAt).getTime() < TRIAL_DURATION_MS;
  }
  return false;
}

interface SubscriptionState {
  tier: SubscriptionTier;
  trialStartedAt: string | null;
  limits: typeof FREE_TIER_LIMITS | typeof PRO_TIER_LIMITS;
  devMode: boolean;
  /** Reactive boolean — true if user has Pro/Trial/DevMode access right now */
  proAccess: boolean;
  setTier: (tier: SubscriptionTier) => void;
  setDevMode: (enabled: boolean) => void;
  setTrialStartedAt: (date: string | null) => void;
  startTrial: () => Promise<void>;
  /** @deprecated Use proAccess instead for reactive UI checks */
  isPro: () => boolean;
  isTrialActive: () => boolean;
  hasTrialExpired: () => boolean;
  loadTrialState: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: 'free',
  trialStartedAt: null,
  limits: FREE_TIER_LIMITS,
  devMode: false,
  proAccess: false,

  setTier: (tier) => {
    const { devMode, trialStartedAt } = get();
    const proAccess = computeProAccess(devMode, tier, trialStartedAt);
    set({
      tier,
      proAccess,
      limits: proAccess ? PRO_TIER_LIMITS : FREE_TIER_LIMITS,
    });
  },

  setDevMode: (enabled) => {
    const { tier, trialStartedAt } = get();
    const proAccess = computeProAccess(enabled, tier, trialStartedAt);
    set({
      devMode: enabled,
      proAccess,
      limits: proAccess ? PRO_TIER_LIMITS : FREE_TIER_LIMITS,
    });
  },

  setTrialStartedAt: (date) => {
    const { devMode, tier } = get();
    set({
      trialStartedAt: date,
      proAccess: computeProAccess(devMode, tier, date),
    });
  },

  startTrial: async () => {
    const now = new Date().toISOString();
    set({ tier: 'trial', trialStartedAt: now, limits: PRO_TIER_LIMITS, proAccess: true });
    try {
      await AsyncStorage.setItem(TRIAL_KEY, now);
    } catch {}
  },

  isPro: () => get().proAccess,

  isTrialActive: () => {
    const { tier, trialStartedAt } = get();
    if (tier !== 'trial' || !trialStartedAt) return false;
    return Date.now() - new Date(trialStartedAt).getTime() < TRIAL_DURATION_MS;
  },

  hasTrialExpired: () => {
    const { tier, trialStartedAt } = get();
    if (tier !== 'trial' || !trialStartedAt) return false;
    return Date.now() - new Date(trialStartedAt).getTime() >= TRIAL_DURATION_MS;
  },

  loadTrialState: async () => {
    try {
      const stored = await AsyncStorage.getItem(TRIAL_KEY);
      if (stored) {
        const isStillActive = Date.now() - new Date(stored).getTime() < TRIAL_DURATION_MS;
        const tier: SubscriptionTier = isStillActive ? 'trial' : 'free';
        const { devMode } = get();
        set({
          trialStartedAt: stored,
          tier,
          proAccess: computeProAccess(devMode, tier, stored),
          limits: isStillActive ? PRO_TIER_LIMITS : FREE_TIER_LIMITS,
        });
      }
    } catch {}
  },
}));
