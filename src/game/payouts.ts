// Pay engine: side-bet payout tables and bet settlement.
// All odds are expressed as "X to 1" (profit per unit staked; the stake
// itself is also returned on a win).

export interface PayoutTable {
  tie: number;
  bPair: number;
  pPair: number;
  anyPair: number;  // either side pairs
  smlTiger: number;
  bigTiger: number;
  anyTiger: number;   // banker wins on 6, two or three cards
  tigerTie: number;   // tie with both totals 6
  smlDragon: number;
  bigDragon: number;
  dragonTie: number;  // tie with both totals 7
  dragonTiger4: number;
  dragonTiger5: number;
  dragonTiger6: number;
}

// Sensible market defaults — every value editable in Settings, and
// casinos can carry their own table.
export const DEFAULT_PAYOUTS: PayoutTable = {
  tie: 8,
  bPair: 11,
  pPair: 11,
  anyPair: 5,
  smlTiger: 22,
  bigTiger: 50,
  anyTiger: 12,
  tigerTie: 35,
  smlDragon: 17,
  bigDragon: 40,
  dragonTie: 35,
  dragonTiger4: 30,
  dragonTiger5: 60,
  dragonTiger6: 100,
};

export const PAYOUT_LABELS: Record<keyof PayoutTable, string> = {
  tie: "Tie",
  bPair: "Banker Pair",
  pPair: "Player Pair",
  anyPair: "Any Pair",
  smlTiger: "Small Tiger",
  bigTiger: "Big Tiger",
  anyTiger: "Any Tiger",
  tigerTie: "Tiger Tie (6-6)",
  smlDragon: "Small Dragon",
  bigDragon: "Big Dragon",
  dragonTie: "Dragon Tie (7-7)",
  dragonTiger4: "Dragon Tiger (4 card)",
  dragonTiger5: "Dragon Tiger (5 card)",
  dragonTiger6: "Dragon Tiger (6 card)",
};

export type MainSide = "banker" | "player" | "tie";
export type SideBetType =
  | "tie"
  | "bPair" | "pPair" | "anyPair"
  | "smlTiger" | "bigTiger" | "anyTiger" | "tigerTie"
  | "smlDragon" | "bigDragon" | "dragonTie"
  | "dragonTiger";

export interface BetSlip {
  main?: { side: MainSide; stake: number };
  side: Partial<Record<SideBetType, number>>; // stake per side bet
}

export interface HandResultForSettle {
  outcome: MainSide;
  natural?: boolean;
  bankerPair?: boolean;
  playerPair?: boolean;
  variant?: string; // sml-tiger | lge-tiger | sml-dragon | big-dragon | dragontiger-4/5/6
  // Total both sides finished on when the hand tied (known from Advance-mode
  // card entry). Needed to settle Tiger Tie (6-6) and Dragon Tie (7-7).
  tieTotal?: number;
}

export interface Settlement {
  staked: number;
  returned: number; // stakes returned + winnings
  profit: number;   // returned - staked
  lines: string[];  // human-readable per-bet outcomes
}

/** Every side bet the app can take, in display order. */
export const SIDE_BET_TYPES: SideBetType[] = [
  "tie",
  "bPair", "pPair", "anyPair",
  "smlTiger", "bigTiger", "anyTiger", "tigerTie",
  "smlDragon", "bigDragon", "dragonTie",
  "dragonTiger",
];

/** Short labels used on bet slips and the side-bet counter. */
export const SIDE_BET_LABELS: Record<SideBetType, string> = {
  tie: "Tie",
  bPair: "B Pair", pPair: "P Pair", anyPair: "Any Pair",
  smlTiger: "Sml Tiger", bigTiger: "Big Tiger", anyTiger: "Any Tiger", tigerTie: "Tiger Tie",
  smlDragon: "Sml Dragon", bigDragon: "Big Dragon", dragonTie: "Dragon Tie",
  dragonTiger: "Dragon Tiger",
};

/**
 * Does `type` win on this hand, and at what rate? Single source of truth for
 * both settlement and the side-bet counters, so the two can never disagree.
 * Rate is 0 when the bet loses.
 */
export function sideBetResult(
  type: SideBetType, hand: HandResultForSettle, table: PayoutTable,
): { won: boolean; rate: number } {
  const win = (rate: number) => ({ won: true, rate });
  const lose = { won: false, rate: 0 };
  const v = hand.variant;
  switch (type) {
    case "tie":
      return hand.outcome === "tie" ? win(table.tie) : lose;
    case "bPair":
      return hand.bankerPair ? win(table.bPair) : lose;
    case "pPair":
      return hand.playerPair ? win(table.pPair) : lose;
    case "anyPair":
      return hand.bankerPair || hand.playerPair ? win(table.anyPair) : lose;
    case "anyTiger":
      return v === "sml-tiger" || v === "lge-tiger" ? win(table.anyTiger) : lose;
    case "smlTiger":
      return v === "sml-tiger" ? win(table.smlTiger) : lose;
    case "bigTiger":
      return v === "lge-tiger" ? win(table.bigTiger) : lose;
    case "tigerTie":
      return hand.outcome === "tie" && hand.tieTotal === 6 ? win(table.tigerTie) : lose;
    case "smlDragon":
      // Dragon bets also pay in a Dragon Tiger situation. 4 cards means the
      // Player won on two cards (small); 5 cards settles as small
      // (conservative — venue rules vary).
      return v === "sml-dragon" || v === "dragontiger-4" || v === "dragontiger-5"
        ? win(table.smlDragon) : lose;
    case "bigDragon":
      return v === "big-dragon" || v === "dragontiger-6" ? win(table.bigDragon) : lose;
    case "dragonTie":
      return hand.outcome === "tie" && hand.tieTotal === 7 ? win(table.dragonTie) : lose;
    case "dragonTiger":
      if (v === "dragontiger-4") return win(table.dragonTiger4);
      if (v === "dragontiger-5") return win(table.dragonTiger5);
      if (v === "dragontiger-6") return win(table.dragonTiger6);
      return lose;
  }
}

export function totalStake(slip: BetSlip): number {
  return (slip.main?.stake ?? 0)
    + Object.values(slip.side).reduce((s, v) => s + (v ?? 0), 0);
}

/**
 * Settle a bet slip against a hand result.
 * commission=true: 5% commission on winning Banker bets.
 * commission=false: Banker win on a total of 6 (tiger variants) pays 0.5:1.
 */
export function settle(
  slip: BetSlip,
  hand: HandResultForSettle,
  commission: boolean,
  table: PayoutTable,
): Settlement {
  let staked = 0;
  let returned = 0;
  const lines: string[] = [];

  // ── Main bet ──
  if (slip.main && slip.main.stake > 0) {
    const { side, stake } = slip.main;
    staked += stake;
    if (hand.outcome === "tie") {
      if (side === "tie") {
        const win = stake * table.tie;
        returned += stake + win;
        lines.push(`Tie bet wins +${win}`);
      } else {
        returned += stake; // push
        lines.push(`${side === "banker" ? "Banker" : "Player"} bet pushes (tie)`);
      }
    } else if (side === hand.outcome) {
      let rate = 1;
      if (side === "banker") {
        const tigerWin = hand.variant === "sml-tiger" || hand.variant === "lge-tiger";
        rate = commission ? 0.95 : tigerWin ? 0.5 : 1;
      }
      const win = stake * rate;
      returned += stake + win;
      lines.push(`${side === "banker" ? "Banker" : "Player"} bet wins +${win}${side === "banker" && commission ? " (5% comm)" : ""}${side === "banker" && !commission && rate === 0.5 ? " (win on 6 pays half)" : ""}`);
    } else {
      lines.push(`${side === "banker" ? "Banker" : side === "player" ? "Player" : "Tie"} bet loses −${stake}`);
    }
  }

  // ── Side bets ──
  const sideBet = (type: SideBetType, stake: number) => {
    staked += stake;
    const { won, rate } = sideBetResult(type, hand, table);
    const label = SIDE_BET_LABELS;
    if (won) {
      const win = stake * rate;
      returned += stake + win;
      lines.push(`${label[type]} wins +${win} (${rate}:1)`);
    } else {
      lines.push(`${label[type]} loses −${stake}`);
    }
  };

  for (const [type, stake] of Object.entries(slip.side)) {
    if (stake && stake > 0) sideBet(type as SideBetType, stake);
  }

  return { staked, returned, profit: returned - staked, lines };
}
