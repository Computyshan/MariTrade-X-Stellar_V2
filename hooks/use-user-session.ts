'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { User, JobRole } from '../types';

interface UserSessionState {
  currentUser: User | null;
  allUsers: User[];
  loading: boolean;
  // Called once on app boot — subscribes to Supabase auth changes
  init: () => () => void;
  setCurrentUser: (user: User) => void;
  updateUserKyc: (kycStatus: User['kycStatus'], jobRole?: JobRole, companyName?: string) => void;
  signOut: () => Promise<void>;
  refreshAllUsers: () => Promise<void>;
}

export const useUserSession = create<UserSessionState>((set, get) => ({
  currentUser: null,
  allUsers: [],
  loading: true,

  init: () => {
    // Fetch current session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const dbUser = await fetchUserFromDb(session.user.id);
        set({ currentUser: dbUser ?? null, loading: false });
      } else {
        set({ currentUser: null, loading: false });
      }
    });

    // Subscribe to future auth changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const dbUser = await fetchUserFromDb(session.user.id);
        set({ currentUser: dbUser ?? null });
      } else {
        set({ currentUser: null });
      }
    });

    // Return cleanup for useEffect
    return () => subscription.unsubscribe();
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  updateUserKyc: (kycStatus, jobRole, companyName) =>
    set((state) => {
      if (!state.currentUser) return {};
      const tradePartyRoles: JobRole[] = ['IMPORTER', 'EXPORTER'];
      const updatedUser: User = {
        ...state.currentUser,
        kycStatus,
        ...(jobRole && { jobRole }),
        ...(companyName && { companyName }),
        userType:
          jobRole && tradePartyRoles.includes(jobRole)
            ? 'TRADE_PARTY'
            : 'LOGISTICS_CHAIN',
      };
      return {
        currentUser: updatedUser,
        allUsers: state.allUsers.map((u) =>
          u.id === state.currentUser!.id ? updatedUser : u
        ),
      };
    }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ currentUser: null, allUsers: [] });
  },

  refreshAllUsers: async () => {
    const res = await fetch('/api/users');
    const json = await res.json();
    if (json.success) set({ allUsers: json.data });
  },
}));

// ─── Helper — load the app-level user row from the users table ────────────────

async function fetchUserFromDb(authId: string): Promise<User | null> {
  try {
    const res = await fetch(`/api/users/${authId}`);
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
