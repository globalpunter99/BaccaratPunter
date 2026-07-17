// Player profile: the numeric knobs the signal engine reads, plus the mapping
// from the questionnaire answers to those knobs, and the machine-model presets.
//
// Pure and framework-free (no storage, no React) — persistence lives in
// `lib/profileStore.ts`, the engine that consumes this in `game/signals.ts`.
//
// A profile does NOT claim an edge over independent rounds. It only encodes how
// selective a given player/model is when reading the roads: how much road
// agreement they need, how much conviction, and whether they favour streaks or
// chops. The engine then reports what THAT ruleset would have called on a board.

export type StreakPref = "streak" | "chop" | "adaptive";

export interface ProfileConfig {
  /** Derived roads (Big Eye / Small / Cockroach) that must back the read to open a window. 0-3. */
  minRoadsAligned: number;
  /** Minimum conviction (0-100) before a read becomes a call. */
  confidenceThreshold: number;
  /** Whether the player leans to continue runs, play the alternation, or read the shoe. */
  streakPref: StreakPref;
  /** For streak-followers: min current-column depth before following the run. */
  minColumnDepth: number;
  /** Sit out when the roads give no directional edge (equal red counts either way). */
  sitOutOnConflict: boolean;
}

// ---- Presets -------------------------------------------------------------
// The two machine benchmarks and the fallback "You" before a profile is built.

/** Selective benchmark: needs road agreement and high conviction, sits out on conflict. */
export const SNIPER_CONFIG: ProfileConfig = {
  minRoadsAligned: 2,
  confidenceThreshold: 64,
  streakPref: "adaptive",
  minColumnDepth: 2,
  sitOutOnConflict: true,
};

/** High-volume benchmark: calls almost every readable hand, low bar. */
export const GRINDER_CONFIG: ProfileConfig = {
  minRoadsAligned: 0,
  confidenceThreshold: 50,
  streakPref: "adaptive",
  minColumnDepth: 1,
  sitOutOnConflict: false,
};

/** Default "You" until the questionnaire is filled in — a middle-of-the-road player. */
export const DEFAULT_YOU_CONFIG: ProfileConfig = {
  minRoadsAligned: 1,
  confidenceThreshold: 56,
  streakPref: "adaptive",
  minColumnDepth: 2,
  sitOutOnConflict: false,
};

// ---- Questionnaire answers ----------------------------------------------
// Shape produced by ProfileBuilder. Kept here so `answersToProfile` and the
// component share one type.

export interface Answers {
  sessionFrequency: string;
  primaryStrategy: string;
  windowDefinition: string[];
  minimumRoadsAligned: string;
  streakOrChop: string;
  sitOutThreshold: string;
  handsPerSession: string;
  confidenceThreshold: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const has = (s: string, needle: string) => s.toLowerCase().includes(needle.toLowerCase());

/**
 * Translate questionnaire answers into engine knobs. Matching is done on
 * distinctive substrings of the option text so light copy edits don't silently
 * break the mapping; anything unrecognised falls back to the You default.
 */
export function answersToProfile(a: Answers): ProfileConfig {
  const cfg: ProfileConfig = { ...DEFAULT_YOU_CONFIG };

  // How many derived roads must line up.
  if (has(a.minimumRoadsAligned, "all 3")) cfg.minRoadsAligned = 3;
  else if (has(a.minimumRoadsAligned, "2 out of 3")) cfg.minRoadsAligned = 2;
  else if (has(a.minimumRoadsAligned, "1 is enough")) cfg.minRoadsAligned = 1;
  else if (has(a.minimumRoadsAligned, "don't rely")) cfg.minRoadsAligned = 0;

  // Minimum conviction to call.
  if (has(a.confidenceThreshold, "80%")) cfg.confidenceThreshold = 80;
  else if (has(a.confidenceThreshold, "60")) cfg.confidenceThreshold = 65;
  else if (has(a.confidenceThreshold, "50")) cfg.confidenceThreshold = 52;
  else if (has(a.confidenceThreshold, "gut")) cfg.confidenceThreshold = 55;

  // Streak vs chop lean.
  if (has(a.streakOrChop, "streak")) cfg.streakPref = "streak";
  else if (has(a.streakOrChop, "chop")) cfg.streakPref = "chop";
  else cfg.streakPref = "adaptive"; // "whichever" / "derived roads to decide"

  // Sit-out behaviour when roads conflict.
  cfg.sitOutOnConflict = has(a.sitOutThreshold, "always sit out") || has(a.sitOutThreshold, "sit out for a few");

  // Volume target nudges selectivity: fewer hands = higher bar, more depth.
  if (has(a.handsPerSession, "10 or fewer")) {
    cfg.confidenceThreshold = clamp(cfg.confidenceThreshold + 6, 50, 88);
    cfg.minColumnDepth = Math.max(cfg.minColumnDepth, 2);
  } else if (has(a.handsPerSession, "most hands")) {
    cfg.confidenceThreshold = clamp(cfg.confidenceThreshold - 6, 50, 88);
    cfg.minRoadsAligned = Math.min(cfg.minRoadsAligned, 1);
    cfg.minColumnDepth = 1;
  }

  // Entry approach: "watch a few hands first" wants a deeper run before entering.
  if (has(a.primaryStrategy, "watch a few hands")) cfg.minColumnDepth = Math.max(cfg.minColumnDepth, 2);
  else if (has(a.primaryStrategy, "play most hands")) cfg.minColumnDepth = 1;

  return cfg;
}

// ---- Version dropdown → config ------------------------------------------
// The scoreboard keeps its per-entity version dropdown. Index 0 is the live
// engine read for that entity; later indices are deterministic retunes so the
// dropdown still visibly moves the numbers. All variants are the real engine —
// nothing here is random.

type EntityId = "you" | "sniper" | "grinder";

const retune = (base: ProfileConfig, dConf: number, dRoads: number): ProfileConfig => ({
  ...base,
  confidenceThreshold: clamp(base.confidenceThreshold + dConf, 50, 88),
  minRoadsAligned: clamp(base.minRoadsAligned + dRoads, 0, 3),
});

export function configForVersion(entity: EntityId, version: number, youConfig: ProfileConfig): ProfileConfig {
  if (entity === "you") {
    // 0 — the player's saved/calibrated profile; 1 — the neutral system baseline.
    return version === 0 ? youConfig : DEFAULT_YOU_CONFIG;
  }
  if (entity === "sniper") {
    // 0 — current selective; 1 — looser retune; 2 — tighter retune.
    if (version === 1) return retune(SNIPER_CONFIG, -6, -1);
    if (version === 2) return retune(SNIPER_CONFIG, +4, 0);
    return SNIPER_CONFIG;
  }
  // grinder: 0 — current high-volume; 1 — slightly pickier retune.
  return version === 1 ? retune(GRINDER_CONFIG, +6, +1) : GRINDER_CONFIG;
}
