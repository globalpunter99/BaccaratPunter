import { describe, expect, it } from "vitest";
import type { Outcome } from "./baccarat";
import {
  bigEyeBoy,
  bigRoadColumnHeights,
  groupRuns,
  layoutColumnar,
  placeMarks,
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

  it("marks red (not blue) when the reference column fell short two or more ago", () => {
    // Big Road: col0 = B (height 1), col1 = P,P,P.
    // (1,2): ref col0 height 1 === rowInCol-1 → blue (odd cell).
    // (1,3): ref col0 height 1 <= rowInCol-2 → both compared cells empty → red.
    const stones = toBigRoad(seq("BPPP"));
    expect(bigEyeBoy(stones)).toEqual(["blue", "red"]);
  });
});

describe("layoutColumnar / placeMarks", () => {
  it("stacks same-colour runs downward and starts a new column on change", () => {
    const placed = placeMarks(["red", "red", "blue"], 6);
    expect(placed).toEqual([
      { col: 0, row: 0, value: "red" },
      { col: 0, row: 1, value: "red" },
      { col: 1, row: 0, value: "blue" },
    ]);
  });

  it("dragon-tails right along the bottom row past 6 deep", () => {
    const placed = placeMarks(
      ["red", "red", "red", "red", "red", "red", "red", "red"], 6,
    );
    expect(placed[5]).toEqual({ col: 0, row: 5, value: "red" });
    expect(placed[6]).toEqual({ col: 1, row: 5, value: "red" });
    expect(placed[7]).toEqual({ col: 2, row: 5, value: "red" });
  });

  it("shifts a new column right when an earlier tail occupies its start", () => {
    // 8 reds tail through cols 1 and 2 on row 5; a following blue run of 6
    // then a red must start clear of occupied cells.
    const groups = [Array(8).fill("red"), Array(6).fill("blue"), ["red"]];
    const placed = layoutColumnar(groups, 6);
    const blueStart = placed.find(p => p.value === "blue")!;
    expect(blueStart).toEqual({ col: 1, row: 0, value: "blue" });
    // blue stacks to row 4, then its row-5 cell is taken by the red tail →
    // blue's 6th mark tails right at row 4
    const blues = placed.filter(p => p.value === "blue");
    expect(blues[5]).toEqual({ col: 2, row: 4, value: "blue" });
  });

  it("groupRuns splits consecutive equal marks", () => {
    expect(groupRuns(["red", "red", "blue", "red"])).toEqual([
      ["red", "red"], ["blue"], ["red"],
    ]);
  });
});
