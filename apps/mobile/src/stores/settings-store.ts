import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ devMode: enabled }));
    } catch {}
  },

  loadSettings: async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({ devMode: parsed.devMode ?? false });
      }
    } catch {}
  },
}));
