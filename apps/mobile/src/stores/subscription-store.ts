import { create } from 'zustand';
import { FREE_TIER_LIMITS, PRO_TIER_LIMITS } from '@quenchr/shared';
import type { SubscriptionTier } from '@quenchr/shared';

interface SubscriptionState {
  tier: SubscriptionTier;
  limits: typeof FREE_TIER_LIMITS | typeof PRO_TIER_LIMITS;
  setTier: (tier: SubscriptionTier) => void;
  isPro: () => boolean;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  tier: 'free',
  limits: FREE_TIER_LIMITS,
  setTier: (tier) =>
    set({
      tier,
      limits: tier === 'pro' ? PRO_TIER_LIMITS : FREE_TIER_LIMITS,
    }),
  isPro: () => get().tier === 'pro',
}));
