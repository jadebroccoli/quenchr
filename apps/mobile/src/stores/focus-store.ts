import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──

export interface FocusSession {
  id: string;
  startedAt: number;        // ms timestamp
  durationMinutes: number;
  endsAt: number;           // ms timestamp
  notificationId: string | null;
}

interface FocusState {
  activeSession: FocusSession | null;
  sessionsCompleted: number;
  totalMinutesCompleted: number;
  startSession: (session: FocusSession) => Promise<void>;
  completeSession: () => Promise<void>;
  abandonSession: () => Promise<void>;
  loadFocus: () => Promise<void>;
}

// ── Helpers ──

const STORAGE_KEY = '@quenchr:focus';

async function persist(update: Partial<Omit<FocusState, keyof { [K in keyof FocusState as FocusState[K] extends Function ? K : never]: never }>>) {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    const base = existing ? JSON.parse(existing) : {};
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, ...update }));
  } catch {}
}

// ── Store ──

export const useFocusStore = create<FocusState>((set, get) => ({
  activeSession: null,
  sessionsCompleted: 0,
  totalMinutesCompleted: 0,

  startSession: async (session) => {
    set({ activeSession: session });
    await persist({ activeSession: session });
  },

  completeSession: async () => {
    const session = get().activeSession;
    const completed = get().sessionsCompleted + 1;
    const minutes = get().totalMinutesCompleted + (session?.durationMinutes ?? 0);
    set({ activeSession: null, sessionsCompleted: completed, totalMinutesCompleted: minutes });
    await persist({ activeSession: null, sessionsCompleted: completed, totalMinutesCompleted: minutes });
  },

  abandonSession: async () => {
    set({ activeSession: null });
    await persist({ activeSession: null });
  },

  loadFocus: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const session = parsed.activeSession as FocusSession | null;
      // Expire sessions that ended while app was closed
      const valid = session && session.endsAt > Date.now() ? session : null;
      set({
        activeSession: valid,
        sessionsCompleted: parsed.sessionsCompleted ?? 0,
        totalMinutesCompleted: parsed.totalMinutesCompleted ?? 0,
      });
    } catch {}
  },
}));
