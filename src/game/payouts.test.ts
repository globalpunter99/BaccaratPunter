import { describe, expect, it } from "vitest";
import { DEFAULT_PAYOUTS, settle, type BetSlip } from "./payouts";

const bankerBet = (stake: number): BetSlip => ({ main: { side: "banker", stake }, side: {} });

describe("settle — banker main bet", () => {
  it("commission baccarat: winning banker bet pays 0.95:1", () => {
    const r = settle(bankerBet(100), { outcome: "banker" }, true, DEFAULT_PAYOUTS);
    expect(r.profit).toBe(95);
  });

  it("non-commission: normal banker win pays 1:1", () => {
    const r = settle(bankerBet(100), { outcome: "banker" }, false, DEFAULT_PAYOUTS);
    expect(r.profit).toBe(100);
  });

  it("non-commission: banker win on 6 (small tiger) pays 50% of the bet", () => {
    const r = settle(bankerBet(100), { outcome: "banker", variant: "sml-tiger" }, false, DEFAULT_PAYOUTS);
    expect(r.profit).toBe(50);
  });

  it("non-commission: banker win on 6 (big tiger) pays 50% of the bet", () => {
    const r = settle(bankerBet(100), { outcome: "banker", variant: "lge-tiger" }, false, DEFAULT_PAYOUTS);
    expect(r.profit).toBe(50);
  });

  it("commission baccarat: tiger win still pays 0.95:1 (no half-pay rule)", () => {
    const r = settle(bankerBet(100), { outcome: "banker", variant: "sml-tiger" }, true, DEFAULT_PAYOUTS);
    expect(r.profit).toBe(95);
  });

  it("banker bet pushes on a tie (stake returned)", () => {
    const r = settle(bankerBet(100), { outcome: "tie" }, false, DEFAULT_PAYOUTS);
    expect(r.profit).toBe(0);
    expect(r.returned).toBe(100);
  });

  it("banker bet loses to a player win", () => {
    const r = settle(bankerBet(100), { outcome: "player" }, false, DEFAULT_PAYOUTS);
    expect(r.profit).toBe(-100);
  });
});

describe("settle — side bets", () => {
  it("tie bet pays table odds", () => {
    const r = settle({ main: { side: "tie", stake: 50 }, side: {} }, { outcome: "tie" }, true, DEFAULT_PAYOUTS);
    expect(r.profit).toBe(50 * DEFAULT_PAYOUTS.tie);
  });

  it("any pair wins when either side pairs", () => {
    const r = settle({ side: { anyPair: 50 } }, { outcome: "player", bankerPair: true }, true, DEFAULT_PAYOUTS);
    expect(r.profit).toBe(50 * DEFAULT_PAYOUTS.anyPair);
  });

  it("tiger tie settles on a 6-6 tie only", () => {
    const win = settle({ side: { tigerTie: 10 } }, { outcome: "tie", tieTotal: 6 }, true, DEFAULT_PAYOUTS);
    expect(win.profit).toBe(10 * DEFAULT_PAYOUTS.tigerTie);
    const lose = settle({ side: { tigerTie: 10 } }, { outcome: "tie", tieTotal: 7 }, true, DEFAULT_PAYOUTS);
    expect(lose.profit).toBe(-10);
  });

  it("dragon bet cross-pays in a dragon tiger situation", () => {
    const r = settle({ side: { smlDragon: 10 } }, { outcome: "player", variant: "dragontiger-4" }, true, DEFAULT_PAYOUTS);
    expect(r.profit).toBe(10 * DEFAULT_PAYOUTS.smlDragon);
  });
});
