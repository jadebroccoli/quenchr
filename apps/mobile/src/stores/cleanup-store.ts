import { create } from 'zustand';
import type { CleanupTask, UserCleanupProgress, Challenge, UserChallenge, Streak } from '@quenchr/shared';

interface CleanupState {
  tasks: CleanupTask[];
  progress: UserCleanupProgress[];
  challenges: (UserChallenge & { challenge: Challenge })[];
  streak: Streak | null;
  tasksCompletedToday: number;
  setTasks: (tasks: CleanupTask[]) => void;
  setProgress: (progress: UserCleanupProgress[]) => void;
  setChallenges: (challenges: (UserChallenge & { challenge: Challenge })[]) => void;
  setStreak: (streak: Streak | null) => void;
  setTasksCompletedToday: (count: number) => void;
  incrementTasksCompletedToday: () => void;
}

export const useCleanupStore = create<CleanupState>((set) => ({
  tasks: [],
  progress: [],
  challenges: [],
  streak: null,
  tasksCompletedToday: 0,
  setTasks: (tasks) => set({ tasks }),
  setProgress: (progress) => set({ progress }),
  setChallenges: (challenges) => set({ challenges }),
  setStreak: (streak) => set({ streak }),
  setTasksCompletedToday: (tasksCompletedToday) => set({ tasksCompletedToday }),
  incrementTasksCompletedToday: () => set((s) => ({ tasksCompletedToday: s.tasksCompletedToday + 1 })),
}));
