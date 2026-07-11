// Pay engine: side-bet payout tables and bet settlement.
// All odds are expressed as "X to 1" (profit per unit staked; the stake
// itself is also returned on a win).

export interface PayoutTable {
  tie: number;
  bPair: number;
  pPair: number;
  smlTiger: number;
  bigTiger: number;
  smlDragon: number;
  bigDragon: number;
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
  smlTiger: 22,
  bigTiger: 50,
  smlDragon: 17,
  bigDragon: 40,
  dragonTiger4: 30,
  dragonTiger5: 60,
  dragonTiger6: 100,
};

export const PAYOUT_LABELS: Record<keyof PayoutTable, string> = {
  tie: "Tie",
  bPair: "Banker Pair",
  pPair: "Player Pair",
  smlTiger: "Small Tiger",
  bigTiger: "Big Tiger",
  smlDragon: "Small Dragon",
  bigDragon: "Big Dragon",
  dragonTiger4: "Dragon Tiger (4 card)",
  dragonTiger5: "Dragon Tiger (5 card)",
  dragonTiger6: "Dragon Tiger (6 card)",
};

export type MainSide = "banker" | "player" | "tie";
export type SideBetType = "bPair" | "pPair" | "tiger" | "dragon" | "dragonTiger";

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
}

export interface Settlement {
  staked: number;
  returned: number; // stakes returned + winnings
  profit: number;   // returned - staked
  lines: string[];  // human-readable per-bet outcomes
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
    let rate = 0;
    let won = false;
    switch (type) {
      case "bPair":
        won = !!hand.bankerPair; rate = table.bPair; break;
      case "pPair":
        won = !!hand.playerPair; rate = table.pPair; break;
      case "tiger":
        if (hand.variant === "sml-tiger") { won = true; rate = table.smlTiger; }
        if (hand.variant === "lge-tiger") { won = true; rate = table.bigTiger; }
        break;
      case "dragon":
        // Dragon bets also pay in a Dragon Tiger situation. 4 cards means
        // the Player won on two cards (small); 6 cards means three (big);
        // 5 cards is settled as small (conservative — venue rules vary).
        if (hand.variant === "sml-dragon") { won = true; rate = table.smlDragon; }
        if (hand.variant === "big-dragon") { won = true; rate = table.bigDragon; }
        if (hand.variant === "dragontiger-4" || hand.variant === "dragontiger-5") { won = true; rate = table.smlDragon; }
        if (hand.variant === "dragontiger-6") { won = true; rate = table.bigDragon; }
        break;
      case "dragonTiger":
        if (hand.variant === "dragontiger-4") { won = true; rate = table.dragonTiger4; }
        if (hand.variant === "dragontiger-5") { won = true; rate = table.dragonTiger5; }
        if (hand.variant === "dragontiger-6") { won = true; rate = table.dragonTiger6; }
        break;
    }
    const label: Record<SideBetType, string> = {
      bPair: "B Pair", pPair: "P Pair", tiger: "Tiger", dragon: "Dragon", dragonTiger: "D-Tiger",
    };
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
