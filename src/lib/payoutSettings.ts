// Payout settings store: a default table plus per-casino overrides.
// Persisted to localStorage until the Supabase backend pass.

import { DEFAULT_PAYOUTS, type PayoutTable } from "../game/payouts";

export interface PayoutSettings {
  defaults: PayoutTable;
  casinos: { name: string; table: PayoutTable }[];
}

const KEY = "bp-payout-settings";

export function loadPayoutSettings(): PayoutSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PayoutSettings;
      // Backfill any fields added since the save
      parsed.defaults = { ...DEFAULT_PAYOUTS, ...parsed.defaults };
      parsed.casinos = (parsed.casinos ?? []).map(c => ({
        name: c.name,
        table: { ...DEFAULT_PAYOUTS, ...c.table },
      }));
      return parsed;
    }
  } catch { /* fall through to defaults */ }
  return { defaults: { ...DEFAULT_PAYOUTS }, casinos: [] };
}

export function savePayoutSettings(settings: PayoutSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

/** Table for a session: the casino's own odds if saved, else the defaults. */
export function tableForCasino(settings: PayoutSettings, casinoName: string): PayoutTable {
  const match = settings.casinos.find(
    c => c.name.trim().toLowerCase() === casinoName.trim().toLowerCase(),
  );
  return match ? match.table : settings.defaults;
}
