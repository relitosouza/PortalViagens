import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'DEMANDANTE' | 'SECOL' | 'SEGOV' | 'SF';
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setUser: (user: User | null) => void;
  setToken: (token: string | null) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user }),

  setToken: async (token) => {
    if (token) {
      await AsyncStorage.setItem('@auth_token', token);
    } else {
      await AsyncStorage.removeItem('@auth_token');
    }
    set({ token, isAuthenticated: !!token });
  },

  logout: async () => {
    await AsyncStorage.removeItem('@auth_token');
    await AsyncStorage.removeItem('@auth_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  hydrate: async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      const user = await AsyncStorage.getItem('@auth_user');

      set({
        token: token || null,
        user: user ? JSON.parse(user) : null,
        isAuthenticated: !!token,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
    }
  },
}));
