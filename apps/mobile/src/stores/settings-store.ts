import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscriptionStore } from './subscription-store';

interface SettingsState {
  devMode: boolean;
  frameRetentionConsent: boolean;
  frameRetentionAsked: boolean;
  setDevMode: (enabled: boolean) => void;
  setFrameRetentionConsent: (enabled: boolean) => void;
  setFrameRetentionAsked: (asked: boolean) => void;
  loadSettings: () => Promise<void>;
}

const SETTINGS_KEY = '@quenchr:settings';

/** Persist the full settings object — always include all keys to avoid partial overwrites. */
async function persistSettings(partial: Partial<{ devMode: boolean; frameRetentionConsent: boolean }>) {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const current = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...partial }));
  } catch {}
}

export const useSettingsStore = create<SettingsState>((set) => ({
  devMode: false,
  frameRetentionConsent: false,
  frameRetentionAsked: false,

  setDevMode: async (enabled) => {
    set({ devMode: enabled });
    // Sync to subscription store so isPro() reflects dev mode
    useSubscriptionStore.getState().setDevMode(enabled);
    await persistSettings({ devMode: enabled });
  },

  setFrameRetentionConsent: async (enabled) => {
    set({ frameRetentionConsent: enabled });
    await persistSettings({ frameRetentionConsent: enabled });
  },

  setFrameRetentionAsked: async (asked) => {
    set({ frameRetentionAsked: asked });
    await persistSettings({ frameRetentionAsked: asked });
  },

  loadSettings: async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const devMode = parsed.devMode ?? false;
        const frameRetentionConsent = parsed.frameRetentionConsent ?? false;
        const frameRetentionAsked = parsed.frameRetentionAsked ?? false;
        set({ devMode, frameRetentionConsent, frameRetentionAsked });
        // Sync persisted dev mode to subscription store on app launch
        useSubscriptionStore.getState().setDevMode(devMode);
      }
    } catch {}
  },
}));
