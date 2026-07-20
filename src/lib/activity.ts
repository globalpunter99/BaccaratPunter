// Inactivity policy: a signed-in user stays signed in indefinitely across
// reloads and tab closes, and is only signed out after 24 hours with no
// interaction. Supabase already persists the session and refreshes its access
// token in the background, so the only thing we add is the idle clock.
//
// The clock is a single localStorage timestamp bumped (at most once a minute)
// on real user interaction. It survives reloads, so closing the tab overnight
// and coming back inside the window keeps the session.

const LAST_ACTIVE_KEY = "bp-last-active";

/** How long a session survives with no interaction. */
export const IDLE_LIMIT_MS = 24 * 60 * 60 * 1000;

/** Bump the idle clock at most this often, to keep writes cheap. */
const WRITE_INTERVAL_MS = 60 * 1000;

let lastWrite = 0;

export function markActive(force = false): void {
  const now = Date.now();
  if (!force && now - lastWrite < WRITE_INTERVAL_MS) return;
  lastWrite = now;
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(now));
  } catch { /* private mode / quota — idle check simply falls back to "active" */ }
}

/** Milliseconds since the last recorded interaction, or null if never recorded. */
export function idleFor(): number | null {
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return null;
    const t = Number(raw);
    return Number.isFinite(t) ? Date.now() - t : null;
  } catch {
    return null;
  }
}

export function isIdleExpired(): boolean {
  const idle = idleFor();
  return idle !== null && idle > IDLE_LIMIT_MS;
}

export function clearActivity(): void {
  try { localStorage.removeItem(LAST_ACTIVE_KEY); } catch { /* ignore */ }
  lastWrite = 0;
}

/**
 * Watch for interaction and call `onExpire` once the user has been idle for
 * longer than the limit. Returns a teardown function.
 */
export function watchActivity(onExpire: () => void): () => void {
  markActive(true);

  const bump = () => markActive();
  const events = ["pointerdown", "keydown", "wheel", "touchstart", "focus"] as const;
  events.forEach(e => window.addEventListener(e, bump, { passive: true }));

  // Returning to a backgrounded tab counts as interaction, but only after the
  // idle check — otherwise waking a tab that sat idle for two days would
  // silently renew it.
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    if (isIdleExpired()) onExpire();
    else markActive(true);
  };
  document.addEventListener("visibilitychange", onVisible);

  const timer = window.setInterval(() => {
    if (isIdleExpired()) onExpire();
  }, WRITE_INTERVAL_MS);

  return () => {
    events.forEach(e => window.removeEventListener(e, bump));
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(timer);
  };
}
