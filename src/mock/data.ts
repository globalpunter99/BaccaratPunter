import type { Outcome } from "../game/baccarat";
import type { BetSlip } from "../game/payouts";

export interface Hand {
  id: number;
  outcome: Outcome;
  bankerPair: boolean;
  playerPair: boolean;
  natural: boolean;
  // Extras recorded in Live Session's Advance mode:
  // sml-tiger | lge-tiger | sml-dragon | big-dragon | dragontiger-4/5/6
  variant?: string;
  tieTotal?: number;
  // The player's main-call result on this hand (win/loss tile wash)
  betResult?: "win" | "loss";
}

// One recorded play from a live session: every hand where the player made a
// main call, with or without money down. Call-only plays carry stake 0.
// The slip keeps the full picture (side bets included) for later review.
export interface SessionBet {
  handId: number;
  slip: BetSlip;
  staked: number;
  returned: number;
  profit: number;
}

export interface Session {
  id: string;
  date: string;
  venue: string;
  tableNumber: string;
  type: "live" | "extra";
  hands: Hand[];
  notes?: string;
  // Set when this session was saved from Practice mode: the id of the original
  // shoe it was practised from. Drives the "practice save" badge and the
  // one-click link back to the original.
  practiceOf?: string;
  savedAt?: string;
  // Live-session context (recorded sessions only)
  gameType?: string;
  commission?: boolean;
  // Recorded plays — drives the "You — as recorded" lens + real money P/L
  bets?: SessionBet[];
  details?: {
    shoeNumber?: string;
    minBet?: string;
    maxBet?: string;
    tiger?: boolean;
    dragon?: boolean;
  };
}

export interface ModelCall {
  side: "banker" | "player";
  confidence: number; // 0-100
}

export interface SignalState {
  playability: "grey" | "amber" | "green";
  playabilityLabel: string;
  you: ModelCall | null;
  sniper: ModelCall | null;
  grinder: ModelCall | null;
}

export interface ProfileStat {
  label: string;
  you: string;
  sniper: string;
  grinder: string;
}

// Sample shoe outcomes for demo
const shoe1Outcomes: Outcome[] = [
  "banker","banker","player","banker","banker","player","player","banker",
  "tie","banker","player","player","player","banker","banker","banker",
  "player","player","banker","player","banker","banker","player","player",
  "player","banker","banker","banker","player","player","banker","player",
  "banker","banker","player","banker","player","player","banker","banker",
  "player","banker","banker","player","player","banker","tie","player",
  "banker","banker","player","banker","player","banker","banker","player",
  "player","banker","banker","player","banker","player","player","banker",
];

const shoe2Outcomes: Outcome[] = [
  "player","player","banker","player","banker","banker","player","banker",
  "banker","player","player","banker","banker","player","player","player",
  "banker","banker","banker","player","player","banker","player","player",
  "banker","player","banker","banker","player","banker","player","player",
  "player","banker","banker","banker","player","player","player","banker",
  "banker","player","banker","player","player","banker","player","banker",
];

// A deliberately chop-heavy shoe for reviewing the roads at full width: run
// lengths are mostly 1-2, so 84 hands produce ~55 Big Road columns — well past
// the 36-column default — and the derived roads run longer still. Use it to
// check the side-scroll indicators on every road.
const wideShoeRuns = [
  1, 1, 2, 1, 1, 1, 3, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 1, 4, 1,
  1, 2, 1, 1, 1, 1, 3, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 5, 1,
  1, 1, 2, 1, 1, 1, 1, 2, 1, 1, 3, 1, 1, 1, 2, 1,
];

const wideShoeOutcomes: Outcome[] = (() => {
  const out: Outcome[] = [];
  wideShoeRuns.forEach((len, i) => {
    const side: Outcome = i % 2 === 0 ? "banker" : "player";
    for (let n = 0; n < len; n++) out.push(side);
  });
  // A few ties sprinkled in — they annotate stones rather than start columns
  [12, 31, 58].forEach(i => out.splice(i, 0, "tie"));
  return out;
})();

/**
 * Foundation games — the starter shoes every account has in its Session
 * Library from sign-up. They are ordinary library entries: a user may delete
 * them (the delete persists per user via `hidden_sessions`, so one user
 * removing them never affects anyone else), practise them, and analyse them.
 *
 * These two are placeholders for the real recorded foundation set described in
 * the product notes. They are deliberately two FULL live shoes of differing
 * character rather than slices or mockups, so a new user's first reads are of
 * boards that behave like real ones.
 */
export const FOUNDATION_SESSIONS: Session[] = [
  {
    id: "s1",
    date: "2026-07-05",
    venue: "Crown Melbourne",
    tableNumber: "VIP Table 3",
    type: "live",
    hands: shoe1Outcomes.map((outcome, i) => ({
      id: i + 1,
      outcome,
      bankerPair: i === 7 || i === 42,
      playerPair: i === 19 || i === 55,
      natural: i === 3 || i === 28,
    })),
    notes: "Strong streak patterns mid-shoe",
  },
  {
    id: "s2",
    date: "2026-07-03",
    venue: "Crown Melbourne",
    tableNumber: "Main Floor Table 12",
    type: "live",
    hands: shoe2Outcomes.map((outcome, i) => ({
      id: i + 1,
      outcome,
      bankerPair: i === 5,
      playerPair: i === 11,
      natural: i === 2 || i === 33,
    })),
  },
];

/**
 * Development fixtures — visible ONLY to the super admin. These are not real
 * games: `s1-P1` is a fabricated practice save, `s3`/`s4` are slices dressed
 * up as photo uploads, and `s5` is a layout mockup. They would read as genuine
 * history in a paying user's library, so regular accounts never see them; they
 * stay available to the super admin as test fixtures.
 */
export const DEMO_SESSIONS: Session[] = [
  {
    // A saved practice session (demo) — same shoe as s1, played in Practice
    // mode and saved back. Shows the "Practice" badge and links to s1.
    id: "s1-P1",
    date: "2026-07-10",
    venue: "Crown Melbourne",
    tableNumber: "VIP Table 3",
    type: "live",
    hands: shoe1Outcomes.map((outcome, i) => ({
      id: i + 1,
      outcome,
      bankerPair: i === 7 || i === 42,
      playerPair: i === 19 || i === 55,
      natural: i === 3 || i === 28,
    })),
    practiceOf: "s1",
    savedAt: "2026-07-10",
    notes: "Saved practice session of Crown Melbourne. Result 22W / 14L / 2T (61%).",
  },
  {
    id: "s3",
    date: "2026-06-28",
    venue: "Star Sydney",
    tableNumber: "Baccarat Lounge 2",
    type: "extra",
    hands: shoe1Outcomes.slice(0, 40).map((outcome, i) => ({
      id: i + 1,
      outcome,
      bankerPair: false,
      playerPair: false,
      natural: i === 10,
    })),
    notes: "Uploaded from bead plate photo",
  },
  {
    id: "s4",
    date: "2026-06-20",
    venue: "Sky City Auckland",
    tableNumber: "Table 7",
    type: "extra",
    hands: shoe2Outcomes.map((outcome, i) => ({
      id: i + 1,
      outcome,
      bankerPair: false,
      playerPair: false,
      natural: false,
    })),
    notes: "Uploaded from bead plate photo",
  },
  {
    // Design reference shoe — see `wideShoeOutcomes`. Every road overflows its
    // default width, so the scroll dots and the widened Cockroach bands can be
    // reviewed. Markers are spread across the shoe so every side-bet counter
    // has something to show.
    id: "s5",
    date: "2026-07-18",
    venue: "Design Reference",
    tableNumber: "Wide Shoe Mockup",
    type: "extra",
    hands: wideShoeOutcomes.map((outcome, i) => ({
      id: i + 1,
      outcome,
      bankerPair: i % 17 === 4,
      playerPair: i % 19 === 9,
      natural: i % 7 === 2,
      variant:
        i === 6 ? "sml-tiger" :
        i === 24 ? "lge-tiger" :
        i === 40 ? "sml-dragon" :
        i === 55 ? "big-dragon" :
        i === 68 ? "dragontiger-4" :
        i === 74 ? "dragontiger-6" : undefined,
      tieTotal:
        outcome === "tie" ? (i < 20 ? 6 : i < 45 ? 7 : 4) : undefined,
    })),
    notes: "Mockup: extra-wide shoe for reviewing road column overflow.",
  },
];

/**
 * Every built-in shoe, both sets. Use this ONLY where the audience does not
 * matter — id-collision checks when minting a new session id, and the
 * still-mock Profile/Stats screens. Anything a user actually browses must
 * compose `FOUNDATION_SESSIONS` with `DEMO_SESSIONS` gated on super admin
 * (see `visibleBuiltInSessions`).
 */
export const mockSessions: Session[] = [...FOUNDATION_SESSIONS, ...DEMO_SESSIONS];

/** The built-in shoes this account may see. */
export function visibleBuiltInSessions(isSuperAdmin: boolean): Session[] {
  return isSuperAdmin ? [...FOUNDATION_SESSIONS, ...DEMO_SESSIONS] : FOUNDATION_SESSIONS;
}

export const mockSignal: SignalState = {
  playability: "green",
  playabilityLabel: "Window Open",
  you: { side: "banker", confidence: 82 },
  sniper: { side: "banker", confidence: 76 },
  grinder: { side: "player", confidence: 61 },
};

export const mockProfileStats: ProfileStat[] = [
  { label: "Win Rate (last 10 sessions)", you: "58%", sniper: "54%", grinder: "51%" },
  { label: "Hands played per session", you: "18", sniper: "31", grinder: "44" },
  { label: "Windows identified correctly", you: "7 of 12", sniper: "9 of 18", grinder: "14 of 27" },
  { label: "Preferred bet side", you: "Banker (71%)", sniper: "Banker (65%)", grinder: "Split (50/50)" },
  { label: "Average confidence when calling", you: "79%", sniper: "68%", grinder: "55%" },
  { label: "Longest win streak", you: "6", sniper: "7", grinder: "9" },
  { label: "Longest loss streak", you: "3", sniper: "4", grinder: "7" },
  { label: "Best session (units)", you: "+14", sniper: "+11", grinder: "+8" },
  { label: "Worst session (units)", you: "-5", sniper: "-8", grinder: "-13" },
];

export const mockLeaderboard = [
  { rank: 1, model: "You", session: "Crown 5 Jul", hitRate: 68, calls: 18, wins: 12, units: "+14" },
  { rank: 2, model: "Sniper", session: "Crown 5 Jul", hitRate: 61, calls: 31, wins: 19, units: "+8" },
  { rank: 3, model: "You", session: "Crown 3 Jul", hitRate: 58, calls: 14, wins: 8, units: "+6" },
  { rank: 4, model: "Grinder", session: "Crown 5 Jul", hitRate: 55, calls: 44, wins: 24, units: "+4" },
  { rank: 5, model: "Sniper", session: "Star Sydney 28 Jun", hitRate: 53, calls: 28, wins: 15, units: "+2" },
  { rank: 6, model: "Grinder", session: "Crown 3 Jul", hitRate: 50, calls: 38, wins: 19, units: "0" },
];
