// Session store: user-created sessions (saved from Practice mode) plus the
// favourites set. localStorage is the synchronous cache; every write also
// pushes to Supabase when signed in (see lib/cloud.ts).
// The Library merges these on top of the built-in mock sessions.

import { mockSessions, type Session } from "../mock/data";
import { pushSession, pushDeleteSession, pushUserState } from "./cloud";

const SESSIONS_KEY = "bp-saved-sessions";
const FAV_KEY = "bp-favourites";
const HIDDEN_KEY = "bp-hidden-sessions";

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
  // Echo the original id as `<id>-P<n>`, bumping n past any existing id
  // (saved OR built-in mock) so ids never collide.
  const taken = new Set<string>([...list, ...mockSessions].map(s => s.id));
  const base = draft.practiceOf ?? draft.id ?? "session";
  let n = 1;
  while (taken.has(`${base}-P${n}`)) n++;
  const saved: Session = { ...draft, id: `${base}-P${n}`, savedAt: new Date().toISOString() };
  writeSavedSessions([saved, ...list]);
  pushSession(saved);
  return saved;
}

/**
 * Persist a finished live session from the Live Session screen. Ids run
 * L1, L2, … (never colliding with saved or built-in ids). Returns the
 * stored session.
 */
export function addLiveSession(draft: Omit<Session, "id">): Session {
  const list = loadSavedSessions();
  const taken = new Set<string>([...list, ...mockSessions].map(s => s.id));
  let n = 1;
  while (taken.has(`L${n}`)) n++;
  const saved: Session = { ...draft, id: `L${n}`, savedAt: new Date().toISOString() };
  writeSavedSessions([saved, ...list]);
  pushSession(saved);
  return saved;
}

export function deleteSavedSession(id: string): void {
  writeSavedSessions(loadSavedSessions().filter(s => s.id !== id));
}

// Sessions the user has deleted from the Library. Built-in mock sessions can't
// be removed from code, so hiding them here is how a delete persists; saved
// sessions are also removed from their store. Deletion is permanent.
export function loadHiddenSessions(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* fall through */ }
  return [];
}

export function deleteSession(id: string): void {
  deleteSavedSession(id);
  pushDeleteSession(id);
  const hidden = loadHiddenSessions();
  if (!hidden.includes(id)) {
    const next = [...hidden, id];
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    pushUserState("hidden_sessions", next);
  }
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
  pushUserState("favourites", next);
  return next;
}
