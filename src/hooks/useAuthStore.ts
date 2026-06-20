import { create } from 'zustand';
import { AuthState, AuthUser } from '../types';
import { authService } from '../services/authService';

interface AuthStore extends AuthState {
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: authService.getUser(),
  token: authService.getToken(),
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
      set({ user: null, token: null, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Logout failed' });
    } finally {
      set({ isLoading: false });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const user = authService.getUser();
      const token = authService.getToken();
      set({ user, token });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Auth check failed' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
