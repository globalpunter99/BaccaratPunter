// The signal engine: given a recorded board and a profile, reports what that
// ruleset would have called at each game — a read of the Macau roads, walked
// forward one hand at a time.
//
// IMPORTANT framing (see CLAUDE.md): baccarat rounds are independent events.
// This engine is DESCRIPTIVE of a player's road-reading discipline, not
// predictive of independent outcomes. "Confidence" is conviction in the read,
// not a probability of winning. The engine never peeks ahead — the read for
// game i is computed only from games 0..i-1.
//
// Method ("roads + streak/chop read"):
//   1. Ask the road. Hypothesise the next hand CONTINUES the current column
//      vs FLIPS to a new one; derive what the three derived roads would mark
//      under each hypothesis and count the "regular" (red) marks. The roads
//      thus vote for continue vs flip.
//   2. The player's streak/chop lean (and, when adaptive, the shoe's own
//      recent streakiness) modulates that vote as a secondary term.
//   3. The winning direction picks the side; the strength of the vote sets the
//      confidence; the profile's thresholds decide whether the window opens.

import type { Outcome } from "./baccarat";
import {
  toBigRoad,
  deriveRoadDetailed,
  bigRoadColumnHeights,
  type BigRoadStone,
  type Side,
} from "./roads";
import type { ProfileConfig } from "./profile";

export interface Signal {
  /** The read — the side the roads/profile point to, whether or not the window opens. */
  predictedSide: Side;
  /** Conviction in the read, 0-100. NOT a win probability. */
  confidence: number;
  /** Derived roads (0-3) backing the chosen direction. */
  alignment: number;
  /** True = the profile would call this hand; false = sit out. */
  window: boolean;
}

/** Non-tie stones needed before the engine will read anything. */
const MIN_HISTORY = 4;
/** Honest ceiling on conviction — the roads never justify certainty. */
const CONF_CAP = 90;

const other = (s: Side): Side => (s === "banker" ? "player" : "banker");

/**
 * Marks the three derived roads would produce for a hypothetical next stone of
 * `next`, reusing the tested road derivation. Returns how many are "red"
 * (regular) and how many roads had an opinion at all (some are undefined early
 * in a shoe when there isn't enough column history to compare against).
 */
function marksForNext(history: Outcome[], next: Side): { reds: number; avail: number } {
  const stones = toBigRoad([...history, next]);
  const lastIdx = stones.length - 1;
  let reds = 0;
  let avail = 0;
  for (const lookback of [1, 2, 3] as const) {
    const mark = deriveRoadDetailed(stones, lookback).find(d => d.stoneIndex === lastIdx);
    if (mark) {
      avail++;
      if (mark.mark === "red") reds++;
    }
  }
  return { reds, avail };
}

/**
 * How choppy the recent board is: fraction of the last few COMPLETED columns
 * that were length 1 (a chop). 0 = pure streaks, 1 = pure ping-pong. The
 * current (possibly still-growing) column is excluded.
 */
function choppiness(stones: BigRoadStone[]): number {
  const heights = bigRoadColumnHeights(stones);
  const currentCol = stones[stones.length - 1].col;
  const completed = heights.slice(Math.max(0, currentCol - 6), currentCol);
  if (completed.length === 0) return 0.5; // no completed columns yet — neutral
  const ones = completed.filter(h => h === 1).length;
  return ones / completed.length;
}

/** The read for a single position, given only the hands before it. */
function signalAt(history: Outcome[], cfg: ProfileConfig): Signal | null {
  const stones = toBigRoad(history);
  if (stones.length < MIN_HISTORY) return null;

  const last = stones[stones.length - 1];
  const currentSide = last.side;
  const currentDepth = last.rowInCol;

  // 1. Ask the road: reds if we continue vs if we flip.
  const cont = marksForNext(history, currentSide);
  const flip = marksForNext(history, other(currentSide));
  const roadScore = cont.reds - flip.reds; // + favours continuing the column

  // 2. Streak/chop lean as a secondary term.
  const chop = choppiness(stones);
  let patternScore: number;
  if (cfg.streakPref === "streak") patternScore = 1;
  else if (cfg.streakPref === "chop") patternScore = -1;
  else patternScore = 1 - 2 * chop; // adaptive: +1 streaky … -1 choppy

  // Roads dominate (weight 2); the lean nudges ties and weak reads.
  const direction = roadScore * 2 + patternScore;

  let predictedSide: Side;
  if (direction > 0) predictedSide = currentSide;
  else if (direction < 0) predictedSide = other(currentSide);
  else predictedSide = "banker"; // dead heat → house favourite

  const continuing = predictedSide === currentSide;
  const alignment = continuing ? cont.reds : flip.reds;

  // 3. Confidence: conviction from vote strength, small depth/banker bonuses,
  //    capped — this is never a certainty.
  let confidence = 50 + Math.abs(direction) * 5;
  if (continuing) confidence += Math.min(currentDepth, 4) * 1.5;
  if (predictedSide === "banker") confidence += 1;
  confidence = Math.max(50, Math.min(CONF_CAP, Math.round(confidence)));

  // Window gate per profile.
  const roadsConflict = cont.avail > 0 && cont.reds === flip.reds;
  let window = alignment >= cfg.minRoadsAligned && confidence >= cfg.confidenceThreshold;
  if (cfg.sitOutOnConflict && roadsConflict) window = false;
  if (cfg.streakPref === "streak" && continuing && currentDepth < cfg.minColumnDepth) window = false;

  return { predictedSide, confidence, alignment, window };
}

/** Walk the whole board, returning the read (or null pre-history) per game. */
export function runSignals(outcomes: Outcome[], cfg: ProfileConfig): (Signal | null)[] {
  return outcomes.map((_, i) => signalAt(outcomes.slice(0, i), cfg));
}

/**
 * Reduce the reads to the call array the roads UI consumes: the predicted side
 * where the window is open, null where the profile sits out (or has no read).
 */
export function predictBoard(outcomes: Outcome[], cfg: ProfileConfig): (Outcome | null)[] {
  return runSignals(outcomes, cfg).map(s => (s && s.window ? s.predictedSide : null));
}
