// Account store: a front-end prototype of the user's account settings.
// Username / email / passcode / Face-ID live in localStorage for now; they
// will be replaced by real Supabase auth in the backend pass. The 4-digit
// passcode is a working local lock; password reset and Face-ID are UI stubs
// until the backend and WebAuthn are wired.

import { pushAccount } from "./cloud";

export interface Account {
  username: string;
  email: string;
  passcode: string | null; // 4-digit string, or null when not set
  faceId: boolean;         // opt-in flag (not yet enforced — needs WebAuthn)
}

const KEY = "bp-account";

const EMPTY: Account = { username: "", email: "", passcode: null, faceId: false };

export function loadAccount(): Account {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<Account>) };
  } catch { /* fall through */ }
  return { ...EMPTY };
}

export function saveAccount(account: Account): void {
  localStorage.setItem(KEY, JSON.stringify(account));
  pushAccount({
    username: account.username,
    passcode: account.passcode,
    face_id: account.faceId,
  });
}

export function isValidPasscode(code: string): boolean {
  return /^\d{4}$/.test(code);
}
