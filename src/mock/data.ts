import type { Outcome } from "../game/baccarat";

export interface Hand {
  id: number;
  outcome: Outcome;
  bankerPair: boolean;
  playerPair: boolean;
  natural: boolean;
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

export const mockSessions: Session[] = [
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
];

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
