import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ──

interface WeeklyStats {
  /** YYYY-MM-DD of the Monday this week started */
  weekStart: string;
  respected: number;
  overridden: number;
}

interface MindfulState {
  /** Custom message shown on the Mindful Moment screen. Empty = smart default. */
  personalMessage: string;
  weeklyStats: WeeklyStats;
  setPersonalMessage: (msg: string) => Promise<void>;
  recordPause: (respected: boolean) => Promise<void>;
  loadMindful: () => Promise<void>;
}

// ── Helpers ──

const STORAGE_KEY = '@quenchr:mindful';

function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function freshStats(): WeeklyStats {
  return { weekStart: getWeekStart(), respected: 0, overridden: 0 };
}

async function mergeStorage(update: Record<string, unknown>) {
  try {
    const existing = await AsyncStorage.getItem(STORAGE_KEY);
    const base = existing ? JSON.parse(existing) : {};
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...base, ...update }));
  } catch {}
}

// ── Store ──

export const useMindfulStore = create<MindfulState>((set, get) => ({
  personalMessage: '',
  weeklyStats: freshStats(),

  setPersonalMessage: async (personalMessage) => {
    set({ personalMessage });
    await mergeStorage({ personalMessage });
  },

  recordPause: async (respected) => {
    const thisWeek = getWeekStart();
    const cur = get().weeklyStats;
    const stats: WeeklyStats =
      cur.weekStart === thisWeek ? { ...cur } : freshStats();

    if (respected) stats.respected++;
    else stats.overridden++;

    set({ weeklyStats: stats });
    await mergeStorage({ weeklyStats: stats });
  },

  loadMindful: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const stored: WeeklyStats = parsed.weeklyStats ?? freshStats();
      // Reset if stale week
      const stats =
        stored.weekStart === getWeekStart() ? stored : freshStats();
      set({
        personalMessage: parsed.personalMessage ?? '',
        weeklyStats: stats,
      });
    } catch {}
  },
}));
