// Strategy layer: consumes a history of outcomes plus tunable variables
// and produces a suggestion. Each strategy declares its variables as a
// ParamSpec map so the UI can render inputs and the backtester can vary them.

import type { Outcome } from "./baccarat";

export type Bet = "player" | "banker" | "skip";

export interface Suggestion {
  bet: Bet;
  reason: string;
  confidence: number; // 0..1
}

export interface StrategyContext {
  history: Outcome[]; // most recent last
}

/** A tunable variable: rendered as a number input, swept in backtests. */
export interface ParamSpec {
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export type Params = Record<string, number>;

export interface Strategy {
  label: string;
  description: string;
  params: Record<string, ParamSpec>;
  run: (ctx: StrategyContext, params: Params) => Suggestion;
}

function skip(reason: string): Suggestion {
  return { bet: "skip", reason, confidence: 0 };
}

type Side = Exclude<Outcome, "tie">;

/** Ties are ignored for pattern purposes (standard road-reading convention). */
function nonTie(history: Outcome[]): Side[] {
  return history.filter((o): o is Side => o !== "tie");
}

/** Length of the run of identical results at the end of the sequence. */
function tailStreak(seq: Side[]): number {
  if (seq.length === 0) return 0;
  const last = seq[seq.length - 1];
  let n = 0;
  for (let i = seq.length - 1; i >= 0 && seq[i] === last; i--) n++;
  return n;
}

/** Length of the strictly alternating (chop) run at the end of the sequence. */
function tailChop(seq: Side[]): number {
  if (seq.length < 2) return seq.length;
  let n = 1;
  for (let i = seq.length - 1; i > 0 && seq[i] !== seq[i - 1]; i--) n++;
  return n;
}

const opposite = (s: Side): Side => (s === "player" ? "banker" : "player");

export const strategies: Record<string, Strategy> = {
  baseline: {
    label: "Baseline (always banker)",
    description: "Neutral control: banker has the lowest house edge (~1.06%).",
    params: {},
    run: () => ({
      bet: "banker",
      reason: "Banker has the lowest house edge over the long run.",
      confidence: 0.51,
    }),
  },

  streakFollow: {
    label: "Follow the streak",
    description:
      "Wait for a run of N identical results, then bet it continues.",
    params: {
      minStreak: { label: "Min streak to bet", min: 1, max: 10, step: 1, default: 2 },
    },
    run: (ctx, p) => {
      const seq = nonTie(ctx.history);
      const streak = tailStreak(seq);
      if (streak < p.minStreak)
        return skip(`Waiting for a streak of ${p.minStreak} (currently ${streak}).`);
      const last = seq[seq.length - 1];
      return {
        bet: last,
        reason: `${last} streak of ${streak} ≥ ${p.minStreak}. Following the run.`,
        confidence: Math.min(0.5 + streak * 0.03, 0.65),
      };
    },
  },

  streakFade: {
    label: "Fade the streak",
    description:
      "Wait for a run of N identical results, then bet it breaks.",
    params: {
      minStreak: { label: "Min streak to fade", min: 2, max: 10, step: 1, default: 4 },
    },
    run: (ctx, p) => {
      const seq = nonTie(ctx.history);
      const streak = tailStreak(seq);
      if (streak < p.minStreak)
        return skip(`Waiting for a streak of ${p.minStreak} (currently ${streak}).`);
      const last = seq[seq.length - 1];
      return {
        bet: opposite(last),
        reason: `${last} streak of ${streak} ≥ ${p.minStreak}. Betting the break.`,
        confidence: 0.52,
      };
    },
  },

  chopFollow: {
    label: "Follow the chop",
    description:
      "When results have alternated for N rounds, bet the alternation continues.",
    params: {
      minChop: { label: "Min alternations to bet", min: 2, max: 10, step: 1, default: 3 },
    },
    run: (ctx, p) => {
      const seq = nonTie(ctx.history);
      const chop = tailChop(seq);
      if (seq.length === 0 || chop < p.minChop)
        return skip(`Waiting for ${p.minChop} alternations (currently ${chop}).`);
      const last = seq[seq.length - 1];
      return {
        bet: opposite(last),
        reason: `Chop of ${chop} ≥ ${p.minChop}. Betting the alternation continues.`,
        confidence: 0.52,
      };
    },
  },

  // Add your directive here: declare its variables in `params` and read
  // them in `run`. It appears in every dropdown automatically, and its
  // variables become backtest inputs with no other changes.
};

export type StrategyKey = string;

/** Default parameter values for a strategy. */
export function defaultParams(key: StrategyKey): Params {
  const out: Params = {};
  for (const [name, spec] of Object.entries(strategies[key].params)) {
    out[name] = spec.default;
  }
  return out;
}
