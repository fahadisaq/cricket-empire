/**
 * Auth store — wraps Supabase Auth (email + password). Holds the logged-in
 * user and exposes signUp / signIn / signOut. The session persists across
 * refreshes and devices automatically (Supabase stores it).
 */
import { create } from "zustand";
import { supabase, supabaseEnabled } from "../lib/supabase";

interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  ready: boolean;

  init: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function mapUser(u: { id: string; email?: string } | null | undefined): AuthUser | null {
  if (!u) return null;
  return { id: u.id, email: u.email ?? "" };
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  ready: false,

  init: async () => {
    if (!supabaseEnabled || !supabase) {
      set({ ready: true });
      return;
    }
    const { data } = await supabase.auth.getSession();
    set({ user: mapUser(data.session?.user), ready: true });

    // Keep store in sync with auth changes (login/logout/refresh).
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: mapUser(session?.user) });
    });
  },

  signUp: async (email, password) => {
    if (!supabase) { set({ error: "Auth not configured" }); return false; }
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { set({ loading: false, error: error.message }); return false; }
    // If email confirmation is off, the user is signed in immediately.
    set({ loading: false, user: mapUser(data.user) });
    return true;
  },

  signIn: async (email, password) => {
    if (!supabase) { set({ error: "Auth not configured" }); return false; }
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { set({ loading: false, error: error.message }); return false; }
    set({ loading: false, user: mapUser(data.user) });
    return true;
  },

  signOut: async () => {
    if (supabase) await supabase.auth.signOut();
    set({ user: null });
  },

  clearError: () => set({ error: null }),
}));
