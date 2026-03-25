import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscriptionStore } from './subscription-store';

interface SettingsState {
  devMode: boolean;
  setDevMode: (enabled: boolean) => void;
  loadSettings: () => Promise<void>;
}

const SETTINGS_KEY = '@quenchr:settings';

export const useSettingsStore = create<SettingsState>((set) => ({
  devMode: false,

  setDevMode: async (enabled) => {
    set({ devMode: enabled });
    // Sync to subscription store so isPro() reflects dev mode
    useSubscriptionStore.getState().setDevMode(enabled);
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ devMode: enabled }));
    } catch {}
  },

  loadSettings: async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const devMode = parsed.devMode ?? false;
        set({ devMode });
        // Sync persisted dev mode to subscription store on app launch
        useSubscriptionStore.getState().setDevMode(devMode);
      }
    } catch {}
  },
}));
