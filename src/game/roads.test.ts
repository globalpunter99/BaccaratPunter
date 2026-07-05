import { describe, expect, it } from "vitest";
import type { Outcome } from "./baccarat";
import {
  bigEyeBoy,
  bigRoadColumnHeights,
  toBeadPlate,
  toBigRoad,
} from "./roads";

const CODE: Record<string, Outcome> = { P: "player", B: "banker", T: "tie" };
const seq = (s: string): Outcome[] => [...s].map((c) => CODE[c]);

describe("toBeadPlate", () => {
  it("fills a 6-row grid column-major, ties included", () => {
    const cells = toBeadPlate(seq("BPTB"));
    expect(cells).toEqual([
      { row: 0, col: 0, outcome: "banker" },
      { row: 1, col: 0, outcome: "player" },
      { row: 2, col: 0, outcome: "tie" },
      { row: 3, col: 0, outcome: "banker" },
    ]);
  });

  it("wraps to a new column after 6 rows", () => {
    const cells = toBeadPlate(seq("BBBBBBB"));
    expect(cells[6]).toEqual({ row: 0, col: 1, outcome: "banker" });
  });
});

describe("toBigRoad", () => {
  it("starts a new column on every side change, stacks on repeats", () => {
    const stones = toBigRoad(seq("BBPPP"));
    expect(stones).toEqual([
      { col: 0, rowInCol: 1, side: "banker", ties: 0 },
      { col: 0, rowInCol: 2, side: "banker", ties: 0 },
      { col: 1, rowInCol: 1, side: "player", ties: 0 },
      { col: 1, rowInCol: 2, side: "player", ties: 0 },
      { col: 1, rowInCol: 3, side: "player", ties: 0 },
    ]);
  });

  it("attaches a mid-shoe tie to the preceding stone, not a new column", () => {
    const stones = toBigRoad(seq("BTP"));
    expect(stones).toEqual([
      { col: 0, rowInCol: 1, side: "banker", ties: 1 },
      { col: 1, rowInCol: 1, side: "player", ties: 0 },
    ]);
  });

  it("attaches leading ties (before any B/P) to the first stone", () => {
    const stones = toBigRoad(seq("TTB"));
    expect(stones).toEqual([{ col: 0, rowInCol: 1, side: "banker", ties: 2 }]);
  });

  it("produces column heights matching the final row in each column", () => {
    const stones = toBigRoad(seq("BPBBPP"));
    expect(bigRoadColumnHeights(stones)).toEqual([1, 1, 2, 2]);
  });
});

describe("bigEyeBoy", () => {
  it("matches a hand-derived expectation for a small known sequence", () => {
    // Big Road columns for B,P,B,B,P,P,B: [1,1,2,2,1] (heights)
    // Stones (col,row): (0,1)(1,1)(2,1)(2,2)(3,1)(3,2)(4,1)
    // First two stones have no column history to compare against, so no
    // mark is emitted for them (col 0 and col 1's new-column check needs
    // col-2 >= 0).
    const stones = toBigRoad(seq("BPBBPPB"));
    expect(bigEyeBoy(stones)).toEqual(["red", "blue", "blue", "red", "red"]);
  });
});
