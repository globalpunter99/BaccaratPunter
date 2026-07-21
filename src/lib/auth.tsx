// Auth context. In cloud mode (Supabase configured) it gates the app behind
// sign-in, hydrates the localStorage cache from the cloud once per login, and
// exposes the user's profile (role drives the admin Users tab). In local mode
// (no env vars) it renders children straight through, exactly as before.

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import { supabase, cloudEnabled } from "./supabase";
import { hydrateFromCloud, setCloudUser } from "./cloud";
import { clearActivity, isIdleExpired, markActive, watchActivity } from "./activity";

export interface Profile {
  id: string;
  username: string;
  email: string;
  role: "super_admin" | "admin" | "user";
  status: "active" | "disabled";
  passcode: string | null;
  face_id: boolean;
  created_at: string;
}

interface AuthState {
  /** True while the initial session/profile check runs (cloud mode only). */
  loading: boolean;
  /** Signed-in user id, or null. Always null in local mode. */
  userId: string | null;
  profile: Profile | null;
  isSuperAdmin: boolean;
  localMode: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, username: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: false, userId: null, profile: null, isSuperAdmin: false,
  localMode: true,
  signIn: async () => "Auth not configured",
  signUp: async () => "Auth not configured",
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (data) return data as Profile;

  // No profile row. That means the signup trigger didn't run or failed for
  // this account, which otherwise leaves the user signed in but invisible to
  // `is_active_user()` — every read and write then silently returns nothing.
  // `ensure_profile()` (migration 0005) creates the row for the caller.
  const { data: made, error } = await supabase.rpc("ensure_profile");
  if (error) {
    console.warn("[auth] could not create the missing profile row:", error.message);
    return null;
  }
  return (made as Profile | null) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(cloudEnabled);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    async function adopt(id: string | null) {
      if (cancelled) return;
      if (!id) {
        setCloudUser(null);
        setUserId(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      // Hydrate the local cache BEFORE the app mounts so every store's
      // synchronous load sees the cloud copy.
      await hydrateFromCloud(id);
      const p = await fetchProfile(id);
      if (cancelled) return;
      if (p && p.status === "disabled") {
        await supabase!.auth.signOut();
        alert("This account has been disabled. Contact the administrator.");
        return;
      }
      markActive(true);
      setUserId(id);
      setProfile(p);
      setLoading(false);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user.id ?? null;
      // A persisted session is honoured unless the user has been idle past
      // the 24-hour limit, in which case it is dropped before the app mounts.
      if (id && isIdleExpired()) {
        clearActivity();
        await supabase!.auth.signOut();
        adopt(null);
        return;
      }
      adopt(id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      adopt(session?.user.id ?? null);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  // Idle clock: only runs while signed in, and signs the user out after 24
  // hours with no interaction.
  useEffect(() => {
    if (!supabase || !userId) return;
    return watchActivity(() => {
      clearActivity();
      void signOut();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return "Auth not configured";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signUp = async (email: string, password: string, username: string) => {
    if (!supabase) return "Auth not configured";
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { username } },
    });
    if (error) return error.message;
    // Supabase does not reveal that an address is taken: it returns success
    // with a user carrying no identities. Without this check the user is told
    // to watch for a confirmation email that will never arrive.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      return "That email is already registered. Sign in instead, or reset the password.";
    }
    // With email confirmation enabled there is no session yet.
    if (!data.session) return "CONFIRM_EMAIL";
    return null;
  };

  const signOut = async () => {
    if (!supabase) return;
    clearActivity();
    await supabase.auth.signOut();
    // Drop the per-user cache so the next account doesn't inherit it.
    ["bp-saved-sessions", "bp-favourites", "bp-hidden-sessions",
     "bp-payout-settings", "bp-player-profile", "bp-calibration", "bp-account",
    ].forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{
      loading, userId, profile,
      isSuperAdmin: profile?.role === "super_admin",
      localMode: !cloudEnabled,
      signIn, signUp, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
