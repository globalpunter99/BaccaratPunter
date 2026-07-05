// Core baccarat rules engine: scoring + third-card drawing rules.
// This is the neutral game logic the strategy layer builds on.

export type Outcome = "player" | "banker" | "tie";

/** Baccarat card point value: A=1, 2-9 face value, 10/J/Q/K=0. */
export function cardValue(rank: number): number {
  // rank: 1 (Ace) .. 13 (King)
  if (rank >= 10) return 0;
  return rank;
}

/** A baccarat hand total is the sum of card values, modulo 10. */
export function handTotal(ranks: number[]): number {
  return ranks.reduce((sum, r) => sum + cardValue(r), 0) % 10;
}

export interface Round {
  player: number[];
  banker: number[];
  playerTotal: number;
  bankerTotal: number;
  outcome: Outcome;
}

/**
 * Resolve a full round given the first four dealt ranks, applying the
 * standard "punto banco" third-card rules. `deck` supplies any extra
 * cards needed (player third, banker third), consumed in order.
 */
export function resolveRound(
  playerCards: [number, number],
  bankerCards: [number, number],
  deck: number[]
): Round {
  const player = [...playerCards];
  const banker = [...bankerCards];
  let deckIdx = 0;
  const draw = () => deck[deckIdx++];

  let pTotal = handTotal(player);
  let bTotal = handTotal(banker);

  // Naturals: if either side has 8 or 9, no more cards.
  const natural = pTotal >= 8 || bTotal >= 8;

  if (!natural) {
    let playerThird: number | null = null;

    // Player draws on 0-5, stands on 6-7.
    if (pTotal <= 5) {
      playerThird = draw();
      player.push(playerThird);
      pTotal = handTotal(player);
    }

    // Banker drawing rules.
    if (playerThird === null) {
      // Player stood: banker draws on 0-5.
      if (bTotal <= 5) {
        banker.push(draw());
        bTotal = handTotal(banker);
      }
    } else {
      const t = cardValue(playerThird);
      const bankerDraws =
        bTotal <= 2 ||
        (bTotal === 3 && t !== 8) ||
        (bTotal === 4 && t >= 2 && t <= 7) ||
        (bTotal === 5 && t >= 4 && t <= 7) ||
        (bTotal === 6 && t >= 6 && t <= 7);
      if (bankerDraws) {
        banker.push(draw());
        bTotal = handTotal(banker);
      }
    }
  }

  const outcome: Outcome =
    pTotal > bTotal ? "player" : bTotal > pTotal ? "banker" : "tie";

  return { player, banker, playerTotal: pTotal, bankerTotal: bTotal, outcome };
}

/** Build and shuffle a shoe of `decks` standard 52-card decks (ranks only). */
export function buildShoe(decks = 8): number[] {
  const shoe: number[] = [];
  for (let d = 0; d < decks; d++) {
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) shoe.push(rank);
    }
  }
  // Fisher-Yates shuffle.
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

/** Deal one round from a shoe, mutating the passed index cursor object. */
export function dealFromShoe(shoe: number[], cursor: { i: number }): Round {
  const next = () => shoe[cursor.i++];
  const playerCards: [number, number] = [next(), next()];
  const bankerCards: [number, number] = [next(), next()];
  // Remaining shoe acts as the draw pile for third cards.
  const rest = shoe.slice(cursor.i);
  const round = resolveRound(playerCards, bankerCards, rest);
  // Advance cursor by how many third cards were actually consumed.
  const thirds = round.player.length - 2 + (round.banker.length - 2);
  cursor.i += thirds;
  return round;
}
