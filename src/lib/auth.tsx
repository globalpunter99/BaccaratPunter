// Auth context. In cloud mode (Supabase configured) it gates the app behind
// sign-in, hydrates the localStorage cache from the cloud once per login, and
// exposes the user's profile (role drives the admin Users tab). In local mode
// (no env vars) it renders children straight through, exactly as before.

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import { supabase, cloudEnabled } from "./supabase";
import { hydrateFromCloud, setCloudUser, setActingUser } from "./cloud";
import { clearActivity, isIdleExpired, markActive, watchActivity } from "./activity";

// Per-user cache keys. Cleared on sign-out and whenever the acting account
// changes, so one account's data can never show through as another's.
const USER_CACHE_KEYS = [
  "bp-saved-sessions", "bp-favourites", "bp-hidden-sessions",
  "bp-payout-settings", "bp-player-profile", "bp-calibration", "bp-account",
];

function clearUserCache(): void {
  USER_CACHE_KEYS.forEach(k => localStorage.removeItem(k));
}

// Which account a super admin is currently viewing. Kept in sessionStorage,
// not localStorage: it must survive the reload that re-seeds every store, but
// must NOT outlive the tab — closing it always returns to your own account.
const ACTING_KEY = "bp-acting-user";
const readActingId = (): string | null => {
  try { return sessionStorage.getItem(ACTING_KEY); } catch { return null; }
};

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
  /** The signed-in account's own profile. Drives the admin surfaces. */
  profile: Profile | null;
  isSuperAdmin: boolean;
  localMode: boolean;
  /** Set while a super admin is viewing another account's data. */
  actingProfile: Profile | null;
  /** Enter another account (super admin only). Reloads the app. */
  viewAsUser: (userId: string) => void;
  /** Return to your own account. Reloads the app. */
  stopViewingUser: () => void;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, username: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: false, userId: null, profile: null, isSuperAdmin: false,
  localMode: true, actingProfile: null,
  viewAsUser: () => {},
  stopViewingUser: () => {},
  signIn: async () => "Auth not configured",
  signUp: async () => "Auth not configured",
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Plain read. Safe for any id — a super admin may read every profile. */
async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile | null) ?? null;
}

/**
 * The signed-in account's own profile, repairing it if it is missing.
 *
 * Only ever call this for the CALLER. `ensure_profile()` works on auth.uid(),
 * so calling it for someone else would hand back the caller's own row and the
 * app would think it was looking at that user.
 */
async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const p = await fetchProfile(userId);
  if (p) return p;

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
  const [acting, setActing] = useState<Profile | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    async function adopt(id: string | null) {
      if (cancelled) return;
      if (!id) {
        setCloudUser(null);
        setActing(null);
        setUserId(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setCloudUser(id);

      // The profile has to resolve BEFORE hydration, because whether an
      // acting session is honoured depends on this account being a super
      // admin — a stale sessionStorage key must never grant access on its own.
      const p = await fetchOwnProfile(id);
      if (cancelled) return;
      if (p && p.status === "disabled") {
        await supabase!.auth.signOut();
        alert("This account has been disabled. Contact the administrator.");
        return;
      }

      const wanted = readActingId();
      const canAct = p?.role === "super_admin" && p.status === "active";
      const target = wanted && canAct && wanted !== id ? wanted : null;
      if (wanted && !target) {
        // Not entitled (or pointing at yourself) — drop it rather than
        // silently half-applying it.
        try { sessionStorage.removeItem(ACTING_KEY); } catch { /* ignore */ }
      }

      // Hydrate the local cache BEFORE the app mounts so every store's
      // synchronous load sees the right account's copy.
      if (target) setActingUser(target);
      await hydrateFromCloud(target ?? id);
      if (cancelled) return;

      const ap = target ? await fetchProfile(target) : null;
      if (cancelled) return;

      markActive(true);
      setUserId(id);
      setProfile(p);
      setActing(ap);
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
    try { sessionStorage.removeItem(ACTING_KEY); } catch { /* ignore */ }
    await supabase.auth.signOut();
    // Drop the per-user cache so the next account doesn't inherit it.
    clearUserCache();
    window.location.reload();
  };

  // Entering and leaving another account both go through a full reload. Every
  // store reads localStorage synchronously at mount, so a reload is the only
  // way to guarantee no screen is left holding the previous account's data.
  const viewAsUser = (targetId: string) => {
    if (profile?.role !== "super_admin" || targetId === userId) return;
    try { sessionStorage.setItem(ACTING_KEY, targetId); } catch { /* ignore */ }
    clearUserCache();
    window.location.reload();
  };

  const stopViewingUser = () => {
    try { sessionStorage.removeItem(ACTING_KEY); } catch { /* ignore */ }
    clearUserCache();
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{
      loading, userId, profile,
      isSuperAdmin: profile?.role === "super_admin",
      localMode: !cloudEnabled,
      actingProfile: acting,
      viewAsUser, stopViewingUser,
      signIn, signUp, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
