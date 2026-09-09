import { create } from 'zustand';
import axios from 'axios';
import { User, AuthResponse } from '../types';
import { api } from '../utils/api';
import { getAuthSession, isCurrentAuthSession } from '../utils/authSession';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    const session = getAuthSession();
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<AuthResponse>('/api/auth/login', {
        email,
        password,
      });
      if (!isCurrentAuthSession(session)) return;
      api.setToken(response.data.token);
      set({ user: response.data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      if (!isCurrentAuthSession(session)) return;
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  register: async (data) => {
    const session = getAuthSession();
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<AuthResponse>('/api/auth/register', data);
      if (!isCurrentAuthSession(session)) return;
      api.setToken(response.data.token);
      set({ user: response.data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      if (!isCurrentAuthSession(session)) return;
      set({
        error: error instanceof Error ? error.message : 'Registration failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: () => {
    api.setToken(null);
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
  },

  fetchMe: async () => {
    const session = getAuthSession();
    const token = session.token;
    if (!token) {
      set({ isAuthenticated: false, user: null, isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await api.get<User>('/api/auth/me', { authSession: session });
      if (!isCurrentAuthSession(session)) return;
      set({ user: response.data, isAuthenticated: true, isLoading: false, error: null });
    } catch (error) {
      if (!isCurrentAuthSession(session)) return;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;

      // 認証が実際に失効した場合だけトークンを消す。通信障害や一時的な5xxでは保持する。
      if (status === 401 || status === 403) {
        api.setToken(null);
        set({ user: null, isAuthenticated: false, isLoading: false, error: null });
        return;
      }

      set({
        isLoading: false,
        error: 'サーバーに接続できませんでした。通信状況を確認して再試行してください。',
      });
    }
  },
}));
