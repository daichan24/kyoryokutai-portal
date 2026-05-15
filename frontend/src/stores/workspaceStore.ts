import { create } from 'zustand';
import type { Role } from '../types';
import { useAuthStore } from './authStore';

export type StaffWorkspaceMode = 'personal' | 'browse';

const STORAGE_PREFIX = 'kyoryokutai-staff-workspace-';

function readStored(userId: string): StaffWorkspaceMode {
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + userId);
    if (v === 'personal' || v === 'browse') return v;
  } catch {
    /* ignore */
  }
  return 'browse';
}

interface WorkspaceState {
  staffWorkspaceMode: StaffWorkspaceMode;
  hydratedForUserId: string | null;
  hydrateForUser: (userId: string, role: Role) => void;
  clearHydration: () => void;
  setStaffWorkspaceMode: (mode: StaffWorkspaceMode, userId: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  staffWorkspaceMode: 'browse',
  hydratedForUserId: null,

  clearHydration: () => set({ hydratedForUserId: null }),

  hydrateForUser: (userId, role) => {
    if (role !== 'MASTER' && role !== 'SUPPORT' && role !== 'GOVERNMENT') {
      set({ hydratedForUserId: userId, staffWorkspaceMode: 'browse' });
      return;
    }
    if (get().hydratedForUserId === userId) return;
    set({
      staffWorkspaceMode: readStored(userId),
      hydratedForUserId: userId,
    });
  },

  setStaffWorkspaceMode: (mode, userId) => {
    try {
      localStorage.setItem(STORAGE_PREFIX + userId, mode);
    } catch {
      /* ignore */
    }
    set({ staffWorkspaceMode: mode });
  },
}));

/** 管理役職は常に閲覧・管理運用。隊員は常に personal 相当。 */
export function useStaffWorkspace() {
  const user = useAuthStore((s) => s.user);
  const setStaffWorkspaceMode = useWorkspaceStore((s) => s.setStaffWorkspaceMode);
  const hydrateForUser = useWorkspaceStore((s) => s.hydrateForUser);
  const clearHydration = useWorkspaceStore((s) => s.clearHydration);

  const isStaff =
    !!user && (user.role === 'MASTER' || user.role === 'SUPPORT' || user.role === 'GOVERNMENT');

  return {
    isStaff,
    workspaceMode: (isStaff ? 'browse' : 'personal') as StaffWorkspaceMode,
    setWorkspaceMode: (mode: StaffWorkspaceMode) => {
      if (user && !isStaff) {
        setStaffWorkspaceMode(mode, user.id);
      }
    },
    hydrateForUser,
    clearHydration,
  };
}
