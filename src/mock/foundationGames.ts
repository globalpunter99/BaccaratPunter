// Foundation calibration boards: the fixed set of shoes every user plays
// through to establish their first profile. Each board has a distinct
// character (steady, choppy, changing, unstable, dragon) so the profiler can
// see how the player reads different screens, and checkpoints sit at similar
// depths across boards so the same situations are tested in different shoes.
//
// PLACEHOLDER DATA: these are simulated boards. The real foundation set must
// come from recorded live games and will be loaded with the Supabase backend
// pass — the shapes here (FoundationBoard/checkpoints) are what it will fill.

import type { Outcome } from "../game/baccarat";

export interface FoundationBoard {
  id: string;
  title: string;
  /** Board personality — revealed only AFTER the board is completed so the
   *  player's reads aren't primed. */
  character: string;
  /** What this board tests, shown with the character after completion. */
  hint: string;
  outcomes: Outcome[];
  /** Positions where the player is asked to call the NEXT hand: at
   *  checkpoint p the player sees games 1..p and calls game p+1. */
  checkpoints: number[];
}

const CODE: Record<string, Outcome> = { B: "banker", P: "player", T: "tie" };
const seq = (s: string): Outcome[] => [...s].map(c => CODE[c]);

export const FOUNDATION_BOARDS: FoundationBoard[] = [
  {
    id: "f1",
    title: "Foundation Board 1",
    character: "Steady streaks",
    hint: "Runs held on this board — it tests whether you back a run to continue and how deep you trust a column.",
    outcomes: seq("BBBBPBBBPPPPBBBBBPPPBBBPPPPPBBBBBTPPPPBBBBBPPPPPBBBBTPPPPBBB"),
    checkpoints: [10, 22, 36, 48],
  },
  {
    id: "f2",
    title: "Foundation Board 2",
    character: "Ping-pong chop",
    hint: "A persistent alternation — it tests whether you recognise and ride a chop instead of waiting for streaks.",
    outcomes: seq("BPBPBPPBPBPBPBBPBPBPBPBPPBPBPBPBTBPBPBPBPBPPBPBPBPBPB"),
    checkpoints: [10, 22, 36, 48],
  },
  {
    id: "f3",
    title: "Foundation Board 3",
    character: "Changing road",
    hint: "Streaks early, chop late. Checkpoints repeat similar spots in both halves — it tests whether you notice the road change and adjust, or keep playing the old pattern.",
    outcomes: seq("BBBBBPPPPPBBBBPPPPBBBBBPPPTBPBPBPBPBPBPBPBPBPBPBPBPB"),
    checkpoints: [8, 14, 36, 44, 50],
  },
  {
    id: "f4",
    title: "Foundation Board 4",
    character: "Unstable shoe",
    hint: "No reliable pattern anywhere. On a shoe like this the disciplined read is mostly Sit Out — it tests whether you force calls where there is no window.",
    outcomes: seq("BPPBBBPBPPPPBBPBBPPPBPBBBPPBBPTPBBPPPBBPBPPBBBPPBPBB"),
    checkpoints: [10, 22, 36, 48],
  },
  {
    id: "f5",
    title: "Foundation Board 5",
    character: "Dragon runs",
    hint: "Long tails mid-shoe. It tests the classic mistake of chopping a streak that should be left to run out.",
    outcomes: seq("BPBPPBBPPPPPPPPPPPBPBBPPBBBBBBBBBBBPBPPBPBBPPBPPBBBB"),
    checkpoints: [10, 22, 36, 48],
  },
];
