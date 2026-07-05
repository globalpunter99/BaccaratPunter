// Strategy layer: consumes a history of outcomes and produces a suggestion.
// Designed so a specific directive/system can be plugged in later.

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

/** House edge favors banker slightly; this is the neutral baseline. */
export const BASELINE: Suggestion = {
  bet: "banker",
  reason: "Banker has the lowest house edge (~1.06%) over the long run.",
  confidence: 0.51,
};

/**
 * Follow-the-streak: bet with the current run of non-tie results.
 * A common (though not mathematically edge-positive) tracking system —
 * kept simple so it can be swapped for your directive later.
 */
export function followStreak(ctx: StrategyContext): Suggestion {
  const nonTie = ctx.history.filter((o) => o !== "tie");
  if (nonTie.length === 0) return BASELINE;

  const last = nonTie[nonTie.length - 1] as Exclude<Outcome, "tie">;
  let streak = 0;
  for (let i = nonTie.length - 1; i >= 0 && nonTie[i] === last; i--) streak++;

  return {
    bet: last,
    reason: `Current ${last} streak of ${streak}. Following the run.`,
    confidence: Math.min(0.5 + streak * 0.03, 0.65),
  };
}

/**
 * Registry of pluggable strategies. Add your directive here later and
 * point the UI at it by key.
 */
export const strategies: Record<
  string,
  { label: string; run: (ctx: StrategyContext) => Suggestion }
> = {
  baseline: {
    label: "Baseline (always banker)",
    run: () => BASELINE,
  },
  streak: {
    label: "Follow the streak",
    run: followStreak,
  },
};

export type StrategyKey = keyof typeof strategies;
