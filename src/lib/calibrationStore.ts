// Calibration store: the player's guess-the-next-hand answers on the
// foundation boards, persisted to localStorage (Supabase later), plus the
// trait derivation the profiler reads from them.
//
// Profiling rule (per the product design): ONLY guesses that matched the
// actual result are used to describe the player's style. Wrong guesses and
// sit-outs still matter — but as discipline/selectivity measures, not as
// style evidence.

import type { Outcome } from "../game/baccarat";
import type { FoundationBoard } from "../mock/foundationGames";
import { pushUserState } from "./cloud";

export type CalGuess = "banker" | "player" | "skip";

export interface CalAnswer {
  boardId: string;
  /** The player saw games 1..position and called game position+1. */
  position: number;
  guess: CalGuess;
  actual: Outcome;
  /** true/false for a decided call; null for a skip or a tie result (push). */
  correct: boolean | null;
}

export interface CalibrationState {
  answers: CalAnswer[];
  /** Board ids fully completed. */
  completed: string[];
}

const KEY = "bp-calibration";

export function loadCalibration(): CalibrationState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as CalibrationState;
  } catch { /* fall through */ }
  return { answers: [], completed: [] };
}

export function saveCalibration(state: CalibrationState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
  pushUserState("calibration", state);
}

export function resetCalibration(): void {
  localStorage.removeItem(KEY);
  pushUserState("calibration", { answers: [], completed: [] });
}

// ---- Trait derivation ----------------------------------------------------

export interface CalibrationTraits {
  /** Decided calls made (banker/player, non-tie result). */
  reads: number;
  correct: number;
  hitRate: number; // 0-100
  skips: number;
  /** Among CORRECT calls only: how many continued the side that just won
   *  (streak-follow) vs called the flip. */
  follows: number;
  flips: number;
  /** 0..1 — 1 = pure streak follower, 0 = pure chop caller (correct calls only). */
  streakLean: number;
  perBoard: { boardId: string; correct: number; reads: number; skips: number }[];
}

export function deriveTraits(
  state: CalibrationState, boards: FoundationBoard[],
): CalibrationTraits {
  let reads = 0, correct = 0, skips = 0, follows = 0, flips = 0;
  const perBoard = boards.map(b => ({ boardId: b.id, correct: 0, reads: 0, skips: 0 }));

  for (const a of state.answers) {
    const pb = perBoard.find(p => p.boardId === a.boardId);
    if (a.guess === "skip") {
      skips++;
      if (pb) pb.skips++;
      continue;
    }
    if (a.correct === null) continue; // tie result — push, no style evidence
    reads++;
    if (pb) pb.reads++;
    if (!a.correct) continue;
    correct++;
    if (pb) pb.correct++;

    // Style evidence from the correct call: did it follow the last winning
    // side or call the flip?
    const board = boards.find(b => b.id === a.boardId);
    if (board) {
      const prior = board.outcomes.slice(0, a.position);
      const lastSide = [...prior].reverse().find(o => o !== "tie");
      if (lastSide) {
        if (a.guess === lastSide) follows++;
        else flips++;
      }
    }
  }

  const styled = follows + flips;
  return {
    reads, correct, skips, follows, flips,
    hitRate: reads ? Math.round((correct / reads) * 100) : 0,
    streakLean: styled ? follows / styled : 0.5,
    perBoard,
  };
}

/** Short label for the streak/chop lean the correct calls show. */
export function leanLabel(t: CalibrationTraits): string {
  if (t.follows + t.flips === 0) return "No evidence yet";
  if (t.streakLean >= 0.65) return "Streak follower";
  if (t.streakLean <= 0.35) return "Chop caller";
  return "Adaptive — reads the shoe";
}
