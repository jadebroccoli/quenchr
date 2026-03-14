import { create } from 'zustand';
import type { User } from '@quenchr/shared';

interface AuthState {
  user: User | null;
  session: { access_token: string } | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: { access_token: string } | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  signOut: () => set({ user: null, session: null }),
}));
