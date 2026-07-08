// Derives the traditional Macau "road" screens from a raw hand sequence.
// Every road here is a pure function of `outcomes` — nothing is stored,
// everything is recomputed from the hand list on each render.
//
// Big Eye Boy / Small Road / Cockroach Pig implement the standard
// "compare against an earlier column" algorithm (lookback 1, 2, 3). This is
// the commonly published rule, but road-reading conventions vary slightly
// between sources — sanity-check the output against a real shoe/screen
// before trusting it for anything beyond a rough visual reference.

import type { Outcome } from "./baccarat";

export type Side = "player" | "banker";

// ---- Bead Plate --------------------------------------------------------
// Raw chronological fill of a 6-row grid, column-major. Includes ties as
// their own cell — this is the one road that is a 1:1 record of history.

export interface BeadCell {
  row: number;
  col: number;
  outcome: Outcome;
}

export function toBeadPlate(outcomes: Outcome[], rows = 6): BeadCell[] {
  return outcomes.map((outcome, i) => ({
    row: i % rows,
    col: Math.floor(i / rows),
    outcome,
  }));
}

// ---- Big Road -----------------------------------------------------------
// Ties (P/B only) are the base for every other road. A new column starts
// whenever the winning side changes; ties don't start a column — they
// annotate the most recent stone with a tie count instead.

export interface BigRoadStone {
  col: number; // 0-based column index
  rowInCol: number; // 1-based logical position within the column (uncapped —
  // the "dragon tail" wraparound past 6 rows is a display concern, not
  // reflected here, so derived-road math stays simple)
  side: Side;
  ties: number; // ties that occurred immediately after this stone
}

export function toBigRoad(outcomes: Outcome[]): BigRoadStone[] {
  const stones: BigRoadStone[] = [];
  let pendingTies = 0;
  let col = -1;
  let lastSide: Side | null = null;

  for (const outcome of outcomes) {
    if (outcome === "tie") {
      if (stones.length === 0) pendingTies++;
      else stones[stones.length - 1].ties++;
      continue;
    }

    const side = outcome;
    const rowInCol = side === lastSide ? stones[stones.length - 1].rowInCol + 1 : 1;
    if (side !== lastSide) col++;
    lastSide = side;

    stones.push({ col, rowInCol, side, ties: 0 });
    if (stones.length === 1 && pendingTies > 0) {
      stones[0].ties += pendingTies;
      pendingTies = 0;
    }
  }

  return stones;
}

/** Final height of each Big Road column, indexed by column number. */
export function bigRoadColumnHeights(stones: BigRoadStone[]): number[] {
  const heights: number[] = [];
  for (const s of stones) heights[s.col] = s.rowInCol;
  return heights;
}

// ---- Derived roads (Big Eye Boy, Small Road, Cockroach Pig) -------------
// Each asks "does the Big Road's current shape match its shape `lookback`
// columns ago?" — red for a match (the shoe is behaving regularly), blue
// for a mismatch. Lookback 1 = Big Eye Boy, 2 = Small Road, 3 = Cockroach
// Pig; all three are the same algorithm at a different offset.

export type RoadMark = "red" | "blue";

export function deriveRoad(stones: BigRoadStone[], lookback: 1 | 2 | 3): RoadMark[] {
  const heights = bigRoadColumnHeights(stones);
  const marks: RoadMark[] = [];

  for (const { col, rowInCol } of stones) {
    if (rowInCol === 1) {
      // New column: compare the column just before it to the one
      // `lookback` columns further back — same height means "regular."
      const a = col - 1;
      const b = col - 1 - lookback;
      if (a < 0 || b < 0) continue;
      marks.push(heights[a] === heights[b] ? "red" : "blue");
    } else {
      // Continuing a streak: two-cell comparison against the column
      // `lookback` back. Look at that column's cells at this depth and one
      // above: both filled (it reaches this deep) or both empty (it fell
      // short two or more ago) = regular = red; exactly one filled (it
      // ended right at the previous depth) = odd = blue.
      const ref = col - lookback;
      if (ref < 0) continue;
      marks.push(heights[ref] === rowInCol - 1 ? "blue" : "red");
    }
  }

  return marks;
}

// ---- Columnar layout (display placement) ---------------------------------
// Casino screens place derived-road marks exactly like Big Road stones:
// a run of the same colour stacks downward; a colour change starts a new
// column; runs deeper than `rows` turn right and tail along the bottom
// ("dragon tail"). Collisions with an earlier tail push cells further right.

export interface PlacedCell<T> {
  col: number;
  row: number;
  value: T;
}

export function layoutColumnar<T>(groups: T[][], rows = 6): PlacedCell<T>[] {
  const occupied = new Set<string>();
  const placed: PlacedCell<T>[] = [];
  let nextStart = 0;

  for (const group of groups) {
    let startCol = nextStart;
    while (occupied.has(`${startCol},0`)) startCol++; // dodge earlier tails
    let col = startCol;
    let row = 0;

    group.forEach((value, i) => {
      if (i > 0) {
        if (row < rows - 1 && !occupied.has(`${col},${row + 1}`)) row++;
        else col++; // dragon tail: run right along the current row
      }
      occupied.add(`${col},${row}`);
      placed.push({ col, row, value });
    });

    nextStart = startCol + 1;
  }

  return placed;
}

/** Group consecutive equal marks into runs (columns for display). */
export function groupRuns<T>(items: T[]): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last[0] === item) last.push(item);
    else groups.push([item]);
  }
  return groups;
}

/** Big Road stones placed on the display grid, dragon tail included. */
export function placeBigRoad(stones: BigRoadStone[], rows = 6): PlacedCell<BigRoadStone>[] {
  const byCol: BigRoadStone[][] = [];
  for (const s of stones) {
    (byCol[s.col] ??= []).push(s);
  }
  return layoutColumnar(byCol.filter(Boolean), rows);
}

/** Derived-road marks placed on the display grid, dragon tail included. */
export function placeMarks(marks: RoadMark[], rows = 6): PlacedCell<RoadMark>[] {
  return layoutColumnar(groupRuns(marks), rows);
}

export const bigEyeBoy = (stones: BigRoadStone[]): RoadMark[] => deriveRoad(stones, 1);
export const smallRoad = (stones: BigRoadStone[]): RoadMark[] => deriveRoad(stones, 2);
export const cockroachPig = (stones: BigRoadStone[]): RoadMark[] => deriveRoad(stones, 3);
