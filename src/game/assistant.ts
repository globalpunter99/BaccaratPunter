// The comment assistant: picks the one supportive message the signal box
// shows for the upcoming hand. Rule-based for now — a future agentic version
// replaces pickNote with richer session awareness, but the priorities below
// ARE the product: each rule maps to a known way disciplined players come
// apart at a live table, and the discipline risks (tilt, late shoe, giving a
// run back) always outrank the excitement of an open window.
//
// Pure function of the session facts — no storage, no framework.

import type { Signal } from "./signals";

export interface AssistantNote {
  tone: "good" | "warn" | "info";
  title: string;
  detail: string;
}

export interface AssistantInput {
  /** Hands recorded so far this shoe. */
  handCount: number;
  /** The player's settled main-bet results, in order (ties/skips excluded). */
  betResults: ("win" | "loss")[];
  /** The live read for the upcoming hand (null = not enough history). */
  signal: Signal | null;
  /** Hands after which the shoe counts as nearly done. Default 55. */
  lateShoeAt?: number;
}

/** Length of the trailing run of `kind` at the end of the results list. */
function trailing(results: ("win" | "loss")[], kind: "win" | "loss"): number {
  let n = 0;
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] !== kind) break;
    n++;
  }
  return n;
}

export function assistantNote(input: AssistantInput): AssistantNote {
  const { handCount, betResults, signal } = input;
  const lateShoeAt = input.lateShoeAt ?? 55;

  // 1 — Tilt is the biggest bankroll killer; it outranks everything,
  //     including an open window.
  const losses = trailing(betResults, "loss");
  if (losses >= 3) {
    return {
      tone: "warn",
      title: `Tilt check — ${losses} straight losing bets`,
      detail:
        "This is exactly where discipline breaks. There is no hand you have to win back — " +
        "sit out the next few and let a real window come to you.",
    };
  }

  // 2 — A strong run is where winning sessions get given back.
  const wins = trailing(betResults, "win");
  if (wins >= 4) {
    return {
      tone: "warn",
      title: `${wins} winning bets in a row — set your leave point`,
      detail:
        "Decide now what you walk away with. Giving a good session back by pushing on " +
        "is the most common way winners lose.",
    };
  }

  // 3 — Late shoe: joining or pressing near the end is a known leak.
  if (handCount >= lateShoeAt) {
    return {
      tone: "warn",
      title: "Late in the shoe",
      detail:
        "This shoe is nearly done. Starting new bets this late is a known leak — " +
        "consider seeing it out and waiting for a fresh shoe.",
    };
  }

  // 4 — Not enough road to read: analyse before betting.
  if (!signal) {
    return {
      tone: "info",
      title: "Watch before you bet",
      detail:
        "Not enough road to read yet. Analyse first — call a few hands with no money " +
        "down and see whether your reads are landing before anything goes on the table.",
    };
  }

  // 5 — Window open: back the player to bet their plan (or pass).
  if (signal.window) {
    return {
      tone: "good",
      title: "Window open — this hand fits your profile",
      detail:
        `${signal.confidence}% conviction with ${signal.alignment}/3 derived roads aligned. ` +
        "Bet within your plan — and passing is always allowed.",
    };
  }

  // 6 — No window: sitting out is the profile doing its job.
  return {
    tone: "info",
    title: "No window — sitting out is the play",
    detail:
      "The roads don't meet your thresholds for this hand. Skipped hands cost nothing; " +
      "forced hands do. The readable ones will come.",
  };
}
