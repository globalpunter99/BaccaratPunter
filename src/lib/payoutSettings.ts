// Payout settings store: a default table plus per-casino game types.
// Each casino can carry several named baccarat game types (e.g. Commission,
// Non-Commission, Even Money), each with its own odds table.
// Persisted to localStorage until the Supabase backend pass.

import { DEFAULT_PAYOUTS, type PayoutTable } from "../game/payouts";
import { pushUserState } from "./cloud";

// A named baccarat variant offered at a casino (e.g. Commission,
// Non-Commission, Even Money). It carries the odds table only — whether 5%
// commission applies is chosen per session in Live Session > Session Details,
// so the two can never disagree.
export interface GameType {
  id: string;
  name: string;
  table: PayoutTable;
}

export interface CasinoConfig {
  id: string;
  name: string;
  games: GameType[];
}

export interface PayoutSettings {
  defaults: PayoutTable;
  casinos: CasinoConfig[];
}

const KEY = "bp-payout-settings";

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A fresh game type with the given name and (copied) odds table. */
export function makeGameType(name: string, table: PayoutTable): GameType {
  return { id: newId(), name, table: { ...table } };
}

// Old shape (pre game-types): casinos were { name, table }. Migrate each to a
// single "Standard" game type carrying that table.
type LegacyCasino = { name: string; table?: PayoutTable; games?: unknown };

function migrateCasino(c: LegacyCasino, defaults: PayoutTable): CasinoConfig {
  const games: GameType[] = Array.isArray(c.games)
    ? (c.games as GameType[]).map(g => ({
        id: g.id ?? newId(),
        name: g.name ?? "Standard",
        table: { ...DEFAULT_PAYOUTS, ...g.table },
      }))
    : [makeGameType("Standard", { ...DEFAULT_PAYOUTS, ...(c.table ?? defaults) })];
  return { id: newId(), name: c.name, games };
}

export function loadPayoutSettings(): PayoutSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { defaults?: PayoutTable; casinos?: LegacyCasino[] };
      const defaults = { ...DEFAULT_PAYOUTS, ...parsed.defaults };
      const casinos = (parsed.casinos ?? []).map(c => migrateCasino(c, defaults));
      return { defaults, casinos };
    }
  } catch { /* fall through to defaults */ }
  return { defaults: { ...DEFAULT_PAYOUTS }, casinos: [] };
}

export function savePayoutSettings(settings: PayoutSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
  pushUserState("payout_settings", settings);
}

function findCasino(settings: PayoutSettings, casinoName: string): CasinoConfig | undefined {
  const key = casinoName.trim().toLowerCase();
  if (!key) return undefined;
  return settings.casinos.find(c => c.name.trim().toLowerCase() === key);
}

function findGame(casino: CasinoConfig | undefined, gameTypeName?: string): GameType | undefined {
  if (!casino) return undefined;
  if (gameTypeName) {
    const key = gameTypeName.trim().toLowerCase();
    const match = casino.games.find(g => g.name.trim().toLowerCase() === key);
    if (match) return match;
  }
  return casino.games[0]; // fall back to the casino's first game type
}

/** Odds for a specific casino + game type, else the casino's first game, else defaults. */
export function tableForGame(
  settings: PayoutSettings, casinoName: string, gameTypeName?: string,
): PayoutTable {
  const game = findGame(findCasino(settings, casinoName), gameTypeName);
  return game ? game.table : settings.defaults;
}

/** Compat helper: table for a casino using its first/default game type. */
export function tableForCasino(settings: PayoutSettings, casinoName: string): PayoutTable {
  return tableForGame(settings, casinoName);
}
