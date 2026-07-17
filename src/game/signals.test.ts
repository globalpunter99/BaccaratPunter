import { describe, expect, it } from "vitest";
import type { Outcome } from "./baccarat";
import { predictBoard, runSignals } from "./signals";
import {
  answersToProfile,
  configForVersion,
  GRINDER_CONFIG,
  SNIPER_CONFIG,
  DEFAULT_YOU_CONFIG,
  type Answers,
  type ProfileConfig,
} from "./profile";

const CODE: Record<string, Outcome> = { P: "player", B: "banker", T: "tie" };
const seq = (s: string): Outcome[] => [...s].map(c => CODE[c]);

// A varied, realistic-ish shoe with streaks, chops and a couple of ties.
const BOARD = seq(
  "BBPBBPPBTBPPPBBBPPBPBBPPPBBBPPBPBBPBPPBBPBBPPBTPBBPP",
);

describe("runSignals — honest walk-forward", () => {
  it("returns no read until there is enough history", () => {
    const sig = runSignals(BOARD, GRINDER_CONFIG);
    // Fewer than MIN_HISTORY (4) non-tie stones exist for the first hands.
    expect(sig[0]).toBeNull();
    expect(sig[1]).toBeNull();
    expect(sig[2]).toBeNull();
    expect(sig[3]).toBeNull();
    // Once history builds, reads appear.
    expect(sig.some(s => s !== null)).toBe(true);
  });

  it("only ever predicts banker or player, and confidence stays 50..90", () => {
    for (const s of runSignals(BOARD, DEFAULT_YOU_CONFIG)) {
      if (!s) continue;
      expect(["banker", "player"]).toContain(s.predictedSide);
      expect(s.confidence).toBeGreaterThanOrEqual(50);
      expect(s.confidence).toBeLessThanOrEqual(90);
      expect(s.alignment).toBeGreaterThanOrEqual(0);
      expect(s.alignment).toBeLessThanOrEqual(3);
    }
  });

  it("is deterministic — same board and config give the same reads", () => {
    expect(predictBoard(BOARD, SNIPER_CONFIG)).toEqual(predictBoard(BOARD, SNIPER_CONFIG));
  });

  it("does not peek: a read depends only on earlier hands", () => {
    const half = BOARD.slice(0, 25);
    const full = runSignals(BOARD, DEFAULT_YOU_CONFIG);
    const partial = runSignals(half, DEFAULT_YOU_CONFIG);
    // The first 25 reads must be identical whether or not later hands exist.
    for (let i = 0; i < half.length; i++) {
      expect(full[i]).toEqual(partial[i]);
    }
  });
});

const callCount = (cfg: ProfileConfig) => predictBoard(BOARD, cfg).filter(Boolean).length;

describe("profile selectivity", () => {
  it("Grinder calls more hands than Sniper on the same board", () => {
    expect(callCount(GRINDER_CONFIG)).toBeGreaterThan(callCount(SNIPER_CONFIG));
  });

  it("a stricter confidence threshold never increases the number of calls", () => {
    const loose: ProfileConfig = { ...DEFAULT_YOU_CONFIG, confidenceThreshold: 50, minRoadsAligned: 0 };
    const strict: ProfileConfig = { ...loose, confidenceThreshold: 80 };
    expect(callCount(strict)).toBeLessThanOrEqual(callCount(loose));
  });

  it("requiring more aligned roads never increases the number of calls", () => {
    const base: ProfileConfig = { ...DEFAULT_YOU_CONFIG, confidenceThreshold: 50, minRoadsAligned: 0 };
    const picky: ProfileConfig = { ...base, minRoadsAligned: 3 };
    expect(callCount(picky)).toBeLessThanOrEqual(callCount(base));
  });
});

describe("answersToProfile", () => {
  const strict: Answers = {
    sessionFrequency: "Rarely — special occasions",
    primaryStrategy: "I watch a few hands first, then enter when I see a pattern",
    windowDefinition: ["all_three_aligned"],
    minimumRoadsAligned: "All 3 — I only play when everything lines up",
    streakOrChop: "Streaks — I back the run to continue",
    sitOutThreshold: "I always sit out — I'd rather miss hands than bet blind",
    handsPerSession: "10 or fewer — very selective",
    confidenceThreshold: "I only bet when I'm 80%+ confident",
  };
  const loose: Answers = {
    sessionFrequency: "Once a week or more",
    primaryStrategy: "I play most hands and look for patterns as I go",
    windowDefinition: ["bigroad_streak"],
    minimumRoadsAligned: "I don't rely heavily on derived roads",
    streakOrChop: "Chops — I play the alternation",
    sitOutThreshold: "I play through it — patterns can emerge suddenly",
    handsPerSession: "Most hands in the shoe",
    confidenceThreshold: "50–60% — I'll play on marginal reads",
  };

  it("maps a strict answer set to a selective config", () => {
    const cfg = answersToProfile(strict);
    expect(cfg.minRoadsAligned).toBe(3);
    expect(cfg.confidenceThreshold).toBeGreaterThanOrEqual(80);
    expect(cfg.streakPref).toBe("streak");
    expect(cfg.sitOutOnConflict).toBe(true);
  });

  it("maps a loose answer set to a permissive config", () => {
    const cfg = answersToProfile(loose);
    expect(cfg.minRoadsAligned).toBe(0);
    expect(cfg.streakPref).toBe("chop");
    expect(cfg.sitOutOnConflict).toBe(false);
  });

  it("a strict profile calls no more hands than a loose one", () => {
    expect(callCount(answersToProfile(strict))).toBeLessThanOrEqual(callCount(answersToProfile(loose)));
  });
});

describe("configForVersion", () => {
  it("gives You the saved config at index 0 and the baseline elsewhere", () => {
    const saved: ProfileConfig = { ...DEFAULT_YOU_CONFIG, confidenceThreshold: 77 };
    expect(configForVersion("you", 0, saved)).toEqual(saved);
    expect(configForVersion("you", 1, saved)).toEqual(DEFAULT_YOU_CONFIG);
  });

  it("returns the base preset at index 0 for the machine models", () => {
    expect(configForVersion("sniper", 0, DEFAULT_YOU_CONFIG)).toEqual(SNIPER_CONFIG);
    expect(configForVersion("grinder", 0, DEFAULT_YOU_CONFIG)).toEqual(GRINDER_CONFIG);
  });
});
