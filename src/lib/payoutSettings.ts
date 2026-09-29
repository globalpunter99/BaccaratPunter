// Payout settings store: a default odds table plus a list of casinos, each
// carrying named baccarat game variants.
//
// Every casino automatically carries one "Traditional" game — 5% commission on
// a Banker win and NO side bets. Any other variant (Non-Commission, a Tiger or
// Dragon game, or one that offers side bets) is added by the user and, per
// variant, declares whether commission applies and which side bets it offers.
//
// Casinos live in the `casinos` table in cloud mode (see cloud.ts) and in this
// localStorage cache in local mode; the cache is always the synchronous source
// components read. Each casino is either the owner's private list or, when a
// super admin marks it `universal`, shown read-only to every account.

import { DEFAULT_PAYOUTS, SIDE_BET_TYPES, type PayoutTable, type SideBetType } from "../game/payouts";
import { deleteCasinoRow, pushCasinoRow, pushUserState } from "./cloud";

/** A baccarat variant offered at a casino. */
export interface GameType {
  id: string;
  name: string;
  table: PayoutTable;
  /** 5% commission on a winning Banker bet (true) vs non-commission (false). */
  commission: boolean;
  /** Which side bets this variant offers. Traditional offers none. */
  sideBets: SideBetType[];
}

export interface CasinoConfig {
  id: string;
  name: string;
  /** Super-admin casinos shown to every account. Private otherwise. */
  universal: boolean;
  /** Owning account id (cloud mode); undefined in local mode. */
  owner?: string;
  games: GameType[];
}

export interface PayoutSettings {
  defaults: PayoutTable;
  casinos: CasinoConfig[];
}

const KEY = "bp-payout-settings";
export const TRADITIONAL_NAME = "Traditional";

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const isTraditional = (name: string) => name.trim().toLowerCase() === TRADITIONAL_NAME.toLowerCase();

/** The Traditional game every casino carries: 5% commission, no side bets. */
export function makeTraditionalGame(): GameType {
  return { id: newId(), name: TRADITIONAL_NAME, table: { ...DEFAULT_PAYOUTS }, commission: true, sideBets: [] };
}

/** A fresh game variant. */
export function makeGameType(
  name: string,
  table: PayoutTable,
  opts?: { commission?: boolean; sideBets?: SideBetType[] },
): GameType {
  return {
    id: newId(),
    name,
    table: { ...table },
    commission: opts?.commission ?? false,
    sideBets: opts?.sideBets ?? [],
  };
}

// ── Normalisation (handles legacy shapes stored before this model) ───────────

function normalizeGame(raw: Partial<GameType> & { name?: string }): GameType {
  const name = raw.name ?? "Standard";
  return {
    id: raw.id ?? newId(),
    name,
    table: { ...DEFAULT_PAYOUTS, ...raw.table },
    // Legacy games had no commission flag: infer from the name.
    commission: raw.commission ?? !/(non|even)/i.test(name),
    // Legacy games had no per-game side bets and the slip showed them all, so a
    // migrated non-traditional game keeps every side bet; Traditional has none.
    sideBets: raw.sideBets ?? (isTraditional(name) ? [] : [...SIDE_BET_TYPES]),
  };
}

/** Ensure a Traditional game is present and first. */
function ensureTraditional(games: GameType[]): GameType[] {
  return games.some(g => isTraditional(g.name)) ? games : [makeTraditionalGame(), ...games];
}

export function normalizeCasino(raw: {
  id?: string; name: string; universal?: boolean; owner?: string;
  games?: Array<Partial<GameType> & { name?: string }>;
  table?: PayoutTable; // very old shape: single table, no games
}): CasinoConfig {
  const games = Array.isArray(raw.games) && raw.games.length > 0
    ? raw.games.map(normalizeGame)
    : [makeTraditionalGame()];
  return {
    id: raw.id ?? newId(),
    name: raw.name,
    universal: !!raw.universal,
    owner: raw.owner,
    games: ensureTraditional(games),
  };
}

/** A brand-new casino: one Traditional game, nothing else. */
export function newCasino(name: string, opts?: { universal?: boolean; owner?: string }): CasinoConfig {
  return {
    id: newId(),
    name,
    universal: opts?.universal ?? false,
    owner: opts?.owner,
    games: [makeTraditionalGame()],
  };
}

// ── Load / save ──────────────────────────────────────────────────────────────

export function loadPayoutSettings(): PayoutSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { defaults?: PayoutTable; casinos?: Array<Parameters<typeof normalizeCasino>[0]> };
      return {
        defaults: { ...DEFAULT_PAYOUTS, ...parsed.defaults },
        casinos: (parsed.casinos ?? []).map(normalizeCasino),
      };
    }
  } catch { /* fall through */ }
  return { defaults: { ...DEFAULT_PAYOUTS }, casinos: [] };
}

function writeCache(settings: PayoutSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

/** Save the default odds table (per user). Casinos are saved individually. */
export function saveDefaults(defaults: PayoutTable): void {
  const settings = loadPayoutSettings();
  const next = { ...settings, defaults };
  writeCache(next);
  pushUserState("payout_settings", { defaults });
}

/** Add or update one casino: update the cache and push the row to the cloud. */
export function upsertCasino(casino: CasinoConfig): void {
  const settings = loadPayoutSettings();
  const exists = settings.casinos.some(c => c.id === casino.id);
  const casinos = exists
    ? settings.casinos.map(c => (c.id === casino.id ? casino : c))
    : [...settings.casinos, casino];
  writeCache({ ...settings, casinos });
  pushCasinoRow(casino);
}

/** Remove one casino from the cache and the cloud. */
export function removeCasino(id: string): void {
  const settings = loadPayoutSettings();
  writeCache({ ...settings, casinos: settings.casinos.filter(c => c.id !== id) });
  deleteCasinoRow(id);
}

// ── Lookups used by Live Session, Practice and the Library ───────────────────

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
  return casino.games[0];
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

/** Whether the chosen game applies 5% commission. Unconfigured → false. */
export function commissionForGame(
  settings: PayoutSettings, casinoName: string, gameTypeName?: string,
): boolean {
  return findGame(findCasino(settings, casinoName), gameTypeName)?.commission ?? false;
}

/**
 * Which side bets the chosen game offers. A configured game returns exactly its
 * list (Traditional → none); an unconfigured or manually typed venue falls back
 * to every side bet so free-typed sessions can still bet sides.
 */
export function sideBetsForGame(
  settings: PayoutSettings, casinoName: string, gameTypeName?: string,
): SideBetType[] {
  const game = findGame(findCasino(settings, casinoName), gameTypeName);
  return game ? game.sideBets : [...SIDE_BET_TYPES];
}
