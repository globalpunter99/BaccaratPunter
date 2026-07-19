// Session store: user-created sessions (saved from Practice mode) plus the
// favourites set, persisted to localStorage until the Supabase backend pass.
// The Library merges these on top of the built-in mock sessions.

import type { Session } from "../mock/data";

const SESSIONS_KEY = "bp-saved-sessions";
const FAV_KEY = "bp-favourites";

export function loadSavedSessions(): Session[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) return JSON.parse(raw) as Session[];
  } catch { /* fall through */ }
  return [];
}

function writeSavedSessions(list: Session[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
}

/**
 * Persist a practice save as a NEW, separate session. Its id echoes the
 * original shoe (`<originalId>-P<n>`) so the two sit together and are easy to
 * compare. Returns the stored session, id assigned.
 */
export function addSavedSession(draft: Session): Session {
  const list = loadSavedSessions();
  const base = draft.practiceOf ?? draft.id ?? "session";
  const n = list.filter(s => s.practiceOf === draft.practiceOf).length + 1;
  const saved: Session = { ...draft, id: `${base}-P${n}` };
  writeSavedSessions([saved, ...list]);
  return saved;
}

export function deleteSavedSession(id: string): void {
  writeSavedSessions(loadSavedSessions().filter(s => s.id !== id));
}

// ── Favourites (works for both mock and saved sessions, keyed by id) ──

export function loadFavourites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* fall through */ }
  return [];
}

export function toggleFavourite(id: string): string[] {
  const favs = loadFavourites();
  const next = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}
