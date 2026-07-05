// Backtest engine: replay a strategy (with its variables) over recorded
// boards and report performance. Bets settle at standard punto banco odds:
// player pays 1:1, banker pays 0.95:1 (5% commission), ties push P/B bets.

import type { Outcome } from "./baccarat";
import type { Params, StrategyKey } from "./strategy";
import { strategies } from "./strategy";

export type Progression = "flat" | "martingale" | "paroli";

/** Bet-sizing variables, applied on top of the strategy's bet selection. */
export interface Staking {
  baseUnit: number;
  progression: Progression;
  /** Max doubling steps before the progression resets (martingale/paroli). */
  capSteps: number;
}

export const DEFAULT_STAKING: Staking = {
  baseUnit: 1,
  progression: "flat",
  capSteps: 3,
};

export interface BacktestResult {
  rounds: number;
  bets: number;
  skips: number;
  wins: number;
  losses: number;
  pushes: number;
  /** Wins / (wins + losses); pushes excluded. */
  hitRate: number;
  /** Net units won or lost. */
  net: number;
  maxDrawdown: number;
  /** Running net after each settled bet. */
  equity: number[];
}

export function backtestBoard(
  outcomes: Outcome[],
  strategyKey: StrategyKey,
  params: Params,
  staking: Staking
): BacktestResult {
  const strategy = strategies[strategyKey];
  const r: BacktestResult = {
    rounds: outcomes.length,
    bets: 0,
    skips: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    hitRate: 0,
    net: 0,
    maxDrawdown: 0,
    equity: [],
  };

  let step = 0;
  let peak = 0;

  for (let i = 0; i < outcomes.length; i++) {
    const suggestion = strategy.run({ history: outcomes.slice(0, i) }, params);
    if (suggestion.bet === "skip") {
      r.skips++;
      continue;
    }

    r.bets++;
    const stake = staking.baseUnit * 2 ** step;
    const actual = outcomes[i];

    if (actual === "tie") {
      // Push: stake returned, progression state unchanged.
      r.pushes++;
      continue;
    }

    if (actual === suggestion.bet) {
      r.wins++;
      r.net += suggestion.bet === "banker" ? stake * 0.95 : stake;
      step =
        staking.progression === "paroli"
          ? (step + 1) % (staking.capSteps + 1)
          : 0;
    } else {
      r.losses++;
      r.net -= stake;
      step =
        staking.progression === "martingale"
          ? (step + 1) % (staking.capSteps + 1)
          : 0;
    }

    peak = Math.max(peak, r.net);
    r.maxDrawdown = Math.max(r.maxDrawdown, peak - r.net);
    r.equity.push(r.net);
  }

  const settled = r.wins + r.losses;
  r.hitRate = settled > 0 ? r.wins / settled : 0;
  return r;
}

export interface BoardResult {
  boardId: string;
  boardName: string;
  result: BacktestResult;
}

export interface BacktestSummary {
  perBoard: BoardResult[];
  total: BacktestResult;
}

/** Backtest each board independently, then aggregate totals across them. */
export function backtestBoards(
  boards: { id: string; name: string; outcomes: Outcome[] }[],
  strategyKey: StrategyKey,
  params: Params,
  staking: Staking
): BacktestSummary {
  const perBoard: BoardResult[] = boards.map((b) => ({
    boardId: b.id,
    boardName: b.name,
    result: backtestBoard(b.outcomes, strategyKey, params, staking),
  }));

  const total: BacktestResult = {
    rounds: 0,
    bets: 0,
    skips: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    hitRate: 0,
    net: 0,
    maxDrawdown: 0,
    equity: [],
  };

  let offset = 0;
  let peak = 0;
  for (const { result } of perBoard) {
    total.rounds += result.rounds;
    total.bets += result.bets;
    total.skips += result.skips;
    total.wins += result.wins;
    total.losses += result.losses;
    total.pushes += result.pushes;
    // Chain equity curves so drawdown spans board boundaries.
    for (const v of result.equity) {
      const chained = offset + v;
      total.equity.push(chained);
      peak = Math.max(peak, chained);
      total.maxDrawdown = Math.max(total.maxDrawdown, peak - chained);
    }
    offset += result.net;
  }
  total.net = offset;
  const settled = total.wins + total.losses;
  total.hitRate = settled > 0 ? total.wins / settled : 0;
  return { perBoard, total };
}
