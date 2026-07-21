// Cloud sync layer. localStorage stays the synchronous cache every component
// already reads; this module (a) hydrates that cache from Supabase at login
// and (b) write-through-pushes each save back up, fire-and-forget. When the
// backend isn't configured or no one is signed in, every push is a no-op and
// the app behaves exactly as before (local mode).

import { supabase } from "./supabase";
import type { Session } from "../mock/data";

// The signed-in account, and — for a super admin inspecting someone else's
// data — the account currently being acted on. Every read and write in this
// module targets the ACTING user, so the whole app (Library, Analyse,
// Practice, photos, settings) operates on that account with no per-screen
// changes. RLS still has the final say: only a super admin's own token is
// allowed to touch another user's rows.
let ownUserId: string | null = null;
let actingUserId: string | null = null;

export function setCloudUser(userId: string | null): void {
  ownUserId = userId;
  actingUserId = null;
}

/** Point every subsequent read/write at another account (super admin only). */
export function setActingUser(userId: string | null): void {
  actingUserId = userId;
}

/** The account whose data is being read and written. */
export function getCloudUserId(): string | null {
  return supabase ? (actingUserId ?? ownUserId) : null;
}

function effectiveUserId(): string | null {
  return actingUserId ?? ownUserId;
}

function ready(): boolean {
  return supabase !== null && effectiveUserId() !== null;
}

function logPushError(what: string, error: unknown): void {
  // Fire-and-forget pushes must never break the UI; surface in the console.
  console.warn(`[cloud] failed to push ${what}:`, error);
}

// ── Sessions ────────────────────────────────────────────────────────────────

export function pushSession(s: Session): void {
  if (!ready()) return;
  supabase!.from("sessions").upsert({
    user_id: effectiveUserId(),
    id: s.id,
    date: s.date,
    venue: s.venue,
    table_number: s.tableNumber,
    session_type: s.type,
    game_type: s.gameType ?? "",
    commission: s.commission ?? false,
    notes: s.notes ?? null,
    practice_of: s.practiceOf ?? null,
    hands: s.hands,
    bets: s.bets ?? [],
    details: s.details ?? null,
    saved_at: s.savedAt ?? new Date().toISOString(),
  }).then(({ error }) => { if (error) logPushError(`session ${s.id}`, error); });
}

export function pushDeleteSession(id: string): void {
  if (!ready()) return;
  supabase!.from("sessions").delete()
    .eq("user_id", effectiveUserId()).eq("id", id)
    .then(({ error }) => { if (error) logPushError(`delete session ${id}`, error); });
}

// ── user_state fields (settings documents) ─────────────────────────────────

type StateField =
  | "payout_settings" | "profile_answers" | "calibration"
  | "favourites" | "hidden_sessions";

export function pushUserState(field: StateField, value: unknown): void {
  if (!ready()) return;
  supabase!.from("user_state")
    .upsert({ user_id: effectiveUserId(), [field]: value })
    .then(({ error }) => { if (error) logPushError(field, error); });
}

// ── Account fields → profiles row ───────────────────────────────────────────

export function pushAccount(fields: {
  username?: string; passcode?: string | null; face_id?: boolean;
}): void {
  if (!ready()) return;
  supabase!.from("profiles").update(fields).eq("id", effectiveUserId())
    .then(({ error }) => { if (error) logPushError("account", error); });
}

// ── Hydration: cloud → localStorage cache, once per login ───────────────────
// Runs before the app renders, so every store's synchronous load() sees the
// cloud copy. Local keys are only overwritten when the cloud has data, so a
// brand-new account keeps whatever local work predates it (first save pushes
// it up).

export async function hydrateFromCloud(userId: string): Promise<void> {
  if (!supabase) return;
  // Viewing another account: the cache now belongs to that account, not to
  // the signed-in admin.
  const viewingOther = userId !== ownUserId;

  const [stateRes, sessionsRes, profileRes] = await Promise.all([
    supabase.from("user_state").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("sessions").select("*").eq("user_id", userId),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);

  const st = stateRes.data;
  if (st) {
    if (st.payout_settings) localStorage.setItem("bp-payout-settings", JSON.stringify(st.payout_settings));
    if (st.profile_answers) localStorage.setItem("bp-player-profile", JSON.stringify(st.profile_answers));
    if (st.calibration) localStorage.setItem("bp-calibration", JSON.stringify(st.calibration));
    if (Array.isArray(st.favourites)) localStorage.setItem("bp-favourites", JSON.stringify(st.favourites));
    if (Array.isArray(st.hidden_sessions)) localStorage.setItem("bp-hidden-sessions", JSON.stringify(st.hidden_sessions));
  }

  const rows = sessionsRes.data;
  if (rows) {
    const sessions: Session[] = rows.map(r => ({
      id: r.id,
      date: r.date,
      venue: r.venue,
      tableNumber: r.table_number,
      type: r.session_type,
      hands: r.hands ?? [],
      notes: r.notes ?? undefined,
      practiceOf: r.practice_of ?? undefined,
      savedAt: r.saved_at ?? undefined,
      gameType: r.game_type || undefined,
      commission: r.commission ?? undefined,
      bets: Array.isArray(r.bets) && r.bets.length > 0 ? r.bets : undefined,
      details: r.details ?? undefined,
    }));

    // Reconcile: any locally saved session the cloud doesn't have (saved
    // offline, or its push failed) gets pushed up now, and stays in the
    // merged cache rather than being clobbered.
    //
    // NEVER while viewing another account. The cache is cleared before the
    // switch, so there should be nothing to reconcile — but if anything did
    // linger, this would copy the admin's own shoes into the account being
    // inspected. Viewing someone's library must not write to it.
    let missing: Session[] = [];
    if (!viewingOther) {
      let localSessions: Session[] = [];
      try {
        localSessions = JSON.parse(localStorage.getItem("bp-saved-sessions") ?? "[]");
      } catch { /* ignore a corrupt cache */ }
      const cloudIds = new Set(sessions.map(s => s.id));
      missing = localSessions.filter(s => !cloudIds.has(s.id));
      missing.forEach(pushSession);
    }

    const merged = [...sessions, ...missing]
      .sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
    // While viewing another account an empty result must still land, or the
    // admin's own cache would show through as that user's library.
    if (merged.length > 0 || viewingOther) {
      localStorage.setItem("bp-saved-sessions", JSON.stringify(merged));
    }
  }

  const p = profileRes.data;
  if (p) {
    localStorage.setItem("bp-account", JSON.stringify({
      username: p.username ?? "",
      email: p.email ?? "",
      passcode: p.passcode ?? null,
      faceId: !!p.face_id,
    }));
  }
}
