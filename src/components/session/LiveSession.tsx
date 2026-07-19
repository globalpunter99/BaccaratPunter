import { useMemo, useState } from "react";
import type { Outcome } from "../../game/baccarat";
import RoadsDisplay from "../roads/RoadsDisplay";
import {
  settle, totalStake,
  type BetSlip, type MainSide, type SideBetType, type Settlement,
} from "../../game/payouts";
import { loadPayoutSettings, tableForGame } from "../../lib/payoutSettings";
import { nextSignal, type RoadVote } from "../../game/signals";
import { GRINDER_CONFIG, SNIPER_CONFIG } from "../../game/profile";
import { loadYouConfig } from "../../lib/profileStore";
import { assistantNote } from "../../game/assistant";

interface HandRecord {
  id: number;
  outcome: Outcome;
  bankerPair: boolean;
  playerPair: boolean;
  natural: boolean;
  // Exotic result variant (medium/advance modes): sml-tiger, lge-tiger,
  // sml-dragon, big-dragon, dragontiger-4, dragontiger-5, dragontiger-6
  // (Dragon Tiger: Player wins 7 v Banker 6 — minimum 4 cards, maximum 6)
  variant?: string;
  // Advance mode: raw card ranks as entered (banker/player, up to 3 each)
  cards?: { player: string[]; banker: string[] };
  // Total both sides finished on when the hand tied (Advance mode only) —
  // settles Tiger Tie (6-6) and Dragon Tie (7-7) side bets
  tieTotal?: number;
  // Outcome of the user's main Banker/Player bet on this hand (side bets
  // excluded; ties push and leave no mark)
  betResult?: "win" | "loss";
}

type EntryMode = "basic" | "medium" | "advance";
type CardSlot = string | null; // card rank: A, 2–10, J, Q, K

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

// Baccarat card value: A = 1, 2–9 face value, 10/J/Q/K = 0.
function rankValue(rank: string): number {
  if (rank === "A") return 1;
  const n = parseInt(rank, 10);
  return isNaN(n) || n === 10 ? 0 : n;
}

function handTotal(cards: CardSlot[]): number {
  return cards.reduce<number>((sum, c) => (c === null ? sum : (sum + rankValue(c)) % 10), 0);
}

interface SessionDetails {
  casino: string;
  gameType: string;
  tableNumber: string;
  shoeNumber: string;
  minBet: string;
  maxBet: string;
  notes: string;
  // Commission baccarat: 5% commission on winning Banker bets.
  // Non-commission: Banker win on a total of 6 (big/small tiger) pays
  // the Banker bet at 50%.
  commission: boolean;
  // Side bets available at this table
  tiger: boolean;
  dragon: boolean;
}

export default function LiveSession() {
  const [hands, setHands] = useState<HandRecord[]>([]);

  // Session details — date/time recorded automatically at session start
  const [sessionStart] = useState(() => new Date());
  // Casinos + game types configured in Settings, loaded once on mount.
  const [payoutSettings] = useState(() => loadPayoutSettings());
  const [details, setDetails] = useState<SessionDetails>({
    casino: "", gameType: "", tableNumber: "", shoeNumber: "", minBet: "", maxBet: "", notes: "",
    // Non-commission by default: a Banker win on a total of 6 pays the Banker
    // bet at 50%. Selecting a configured game type overrides this.
    commission: false, tiger: false, dragon: false,
  });
  const [manualCasino, setManualCasino] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showFix, setShowFix] = useState(false);
  const [showRecordInfo, setShowRecordInfo] = useState(false);

  // ── My Bet (pay engine) ────────────────────────────────────────────────
  const [showBets, setShowBets] = useState(false);
  const [sideBetMode, setSideBetMode] = useState(false);
  const [pendingMain, setPendingMain] = useState<MainSide | null>(null);
  const [pendingStake, setPendingStake] = useState(0);
  const [pendingSides, setPendingSides] = useState<Partial<Record<SideBetType, number>>>({});
  const [lastSlip, setLastSlip] = useState<BetSlip | null>(null);
  const [lastSettlement, setLastSettlement] = useState<Settlement | null>(null);
  const [lastCall, setLastCall] = useState<{ side: "banker" | "player"; result: "win" | "loss" | "push" } | null>(null);
  const [lastGame, setLastGame] = useState<number | null>(null);
  const [ledger, setLedger] = useState({ staked: 0, returned: 0, betHands: 0, wonHands: 0 });
  const STAKE_PRESETS = [5, 25, 50, 100, 500, 1000];

  const pendingSlip: BetSlip = {
    main: pendingMain && pendingStake > 0 ? { side: pendingMain, stake: pendingStake } : undefined,
    side: pendingSides,
  };
  const hasPendingBet = totalStake(pendingSlip) > 0;
  // A call = a Banker/Player prediction with no money down (captured for
  // post-game analysis even when the user chose not to bet).
  const hasPendingCall = pendingMain === "banker" || pendingMain === "player";

  function clearPendingBet() {
    setPendingMain(null);
    setPendingStake(0);
    setPendingSides({});
  }

  function repeatLastBet() {
    if (!lastSlip) return;
    setPendingMain(lastSlip.main?.side ?? null);
    setPendingStake(lastSlip.main?.stake ?? 0);
    setPendingSides({ ...lastSlip.side });
  }

  function settlePendingBet(hand: HandRecord) {
    if (!hasPendingBet && !hasPendingCall) return; // nothing = user sat out
    setLastGame(hand.id);

    // Money bet: settle against the pay engine and update the ledger
    if (hasPendingBet) {
      const table = tableForGame(payoutSettings, details.casino, details.gameType);
      const result = settle(pendingSlip, {
        outcome: hand.outcome,
        natural: hand.natural,
        bankerPair: hand.bankerPair,
        playerPair: hand.playerPair,
        variant: hand.variant,
        tieTotal: hand.tieTotal,
      }, details.commission, table);
      setLedger(l => ({
        staked: l.staked + result.staked,
        returned: l.returned + result.returned,
        betHands: l.betHands + 1,
        wonHands: l.wonHands + (result.profit > 0 ? 1 : 0),
      }));
      setLastSettlement(result);
      setLastSlip(pendingSlip);
      setLastCall(null);
    }

    // Record the Banker/Player call on the hand (bet or call-only) so it
    // drives the tile wash and post-game analysis. Ties push.
    if (hasPendingCall) {
      const side = pendingMain as "banker" | "player";
      if (hand.outcome !== "tie") {
        const betResult = side === hand.outcome ? "win" as const : "loss" as const;
        setHands(prev => prev.map(h => (h.id === hand.id ? { ...h, betResult } : h)));
      }
      if (!hasPendingBet) {
        // Call-only: no money, just show the call result
        setLastCall({ side, result: hand.outcome === "tie" ? "push" : side === hand.outcome ? "win" : "loss" });
        setLastSettlement(null);
      }
    }

    clearPendingBet();
  }

  // Correction bar
  const [fixGameNo, setFixGameNo] = useState("");
  const [fixAction, setFixAction] = useState<"delete" | "insert" | "change">("change");
  const [fixOutcome, setFixOutcome] = useState<Outcome>("banker");

  function applyCorrection() {
    const n = parseInt(fixGameNo, 10);
    if (isNaN(n) || n < 1 || n > hands.length + (fixAction === "insert" ? 1 : 0)) return;
    const idx = n - 1;
    setHands(prev => {
      let next: HandRecord[];
      if (fixAction === "delete") {
        next = prev.filter((_, i) => i !== idx); // everything moves back a game
      } else if (fixAction === "insert") {
        const inserted: HandRecord = { id: 0, outcome: fixOutcome, bankerPair: false, playerPair: false, natural: false };
        next = [...prev.slice(0, idx), inserted, ...prev.slice(idx)];
      } else {
        next = prev.map((h, i) => (i === idx ? { ...h, outcome: fixOutcome } : h));
      }
      return next.map((h, i) => ({ ...h, id: i + 1 })); // renumber
    });
    setFixGameNo("");
  }

  const outcomes = hands.map(h => h.outcome);

  // Photo bucket for this live screen. Ephemeral per session (like the hands
  // themselves) until the backend links a saved session; deleting is offered
  // only in the Library, so no delete here.
  const [liveScreenId] = useState(() => `live-${Date.now()}`);

  // Live reads for the upcoming hand, from the real engine under each
  // profile. You drives the window band + road alignment; the assistant
  // reads the session facts (bet streaks, shoe depth) on top of the signal.
  const signals = useMemo(() => ({
    you: nextSignal(outcomes, loadYouConfig()),
    sniper: nextSignal(outcomes, SNIPER_CONFIG),
    grinder: nextSignal(outcomes, GRINDER_CONFIG),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [hands]);
  const assistant = assistantNote({
    handCount: hands.length,
    betResults: hands
      .map(h => h.betResult)
      .filter((r): r is "win" | "loss" => r === "win" || r === "loss"),
    signal: signals.you,
  });

  // Entry mode + advance-mode card slots
  const [entryMode, setEntryMode] = useState<EntryMode>("basic");
  const emptyCards: { player: CardSlot[]; banker: CardSlot[] } = {
    player: [null, null, null], banker: [null, null, null],
  };
  const [cardEntry, setCardEntry] = useState(emptyCards);

  // Advance mode: which slot the next keypad tap fills.
  // Fill order runs left to right per side, Player row then Banker row,
  // matching the table layout from the player's seat.
  const SLOT_ORDER: { side: "player" | "banker"; idx: number }[] = [
    { side: "player", idx: 0 }, { side: "player", idx: 1 }, { side: "player", idx: 2 },
    { side: "banker", idx: 0 }, { side: "banker", idx: 1 }, { side: "banker", idx: 2 },
  ];
  const [activeSlot, setActiveSlot] = useState(0);

  // ── Baccarat drawing rules (the tableau) ──────────────────────────────
  // Banker third-card table: given banker two-card total and the value of
  // the player's third card, does the banker draw?
  function bankerDraws(b2: number, playerThirdValue: number): boolean {
    if (b2 <= 2) return true;
    if (b2 === 3) return playerThirdValue !== 8;
    if (b2 === 4) return playerThirdValue >= 2 && playerThirdValue <= 7;
    if (b2 === 5) return playerThirdValue >= 4 && playerThirdValue <= 7;
    if (b2 === 6) return playerThirdValue === 6 || playerThirdValue === 7;
    return false; // 7 stands
  }

  // Can this slot legally take a card right now?
  function slotEnabled(side: "player" | "banker", idx: number): boolean {
    if (idx < 2) return true;
    const p2ok = cardEntry.player[0] !== null && cardEntry.player[1] !== null;
    const b2ok = cardEntry.banker[0] !== null && cardEntry.banker[1] !== null;
    const p2 = handTotal(cardEntry.player.slice(0, 2));
    const b2 = handTotal(cardEntry.banker.slice(0, 2));

    if (side === "player") {
      if (!p2ok) return false;          // first two cards come first
      if (p2 >= 6) return false;        // stands on 6/7, natural on 8/9
      if (b2ok && b2 >= 8) return false; // banker natural ends the hand
      return true;
    }
    // banker third
    if (!b2ok) return false;
    if (b2 >= 8) return false;          // banker natural
    if (p2ok && p2 >= 8) return false;  // player natural ends the hand
    if (!p2ok) return true;             // not enough info yet — allow
    const playerTakes = p2 <= 5;
    if (!playerTakes) return b2 <= 5;   // player stood: banker draws 0–5
    const p3 = cardEntry.player[2];
    if (p3 === null) return false;      // player's third must be entered first
    return bankerDraws(b2, rankValue(p3));
  }

  function tapCardValue(v: string) {
    // Fill the first empty, rule-legal slot at or after the active one
    let target = -1;
    for (let i = activeSlot; i < SLOT_ORDER.length; i++) {
      const { side, idx } = SLOT_ORDER[i];
      if (cardEntry[side][idx] === null && slotEnabled(side, idx)) { target = i; break; }
    }
    if (target === -1) return;
    const { side, idx } = SLOT_ORDER[target];
    setCardEntry(prev => {
      const next = { ...prev, [side]: [...prev[side]] };
      next[side][idx] = v;
      return next;
    });
    setActiveSlot(Math.min(target + 1, SLOT_ORDER.length));
  }

  // Rule validation across the whole entered hand — blocks OK when violated
  function validateAdvance(): string | null {
    if (!cardsEntered) return null;
    const p2 = handTotal(cardEntry.player.slice(0, 2));
    const b2 = handTotal(cardEntry.banker.slice(0, 2));
    const p3 = cardEntry.player[2];
    const b3 = cardEntry.banker[2];
    if (p2 >= 8 || b2 >= 8) {
      if (p3 !== null || b3 !== null) return "Natural — no third cards are drawn";
      return null;
    }
    const playerTakes = p2 <= 5;
    if (playerTakes && p3 === null) return "Player must draw a third card (total 0–5)";
    if (!playerTakes && p3 !== null) return "Player stands on 6/7 — no third card";
    const bankerTakes = playerTakes ? bankerDraws(b2, rankValue(p3!)) : b2 <= 5;
    if (bankerTakes && b3 === null) return "Banker must draw a third card";
    if (!bankerTakes && b3 !== null) return "Banker stands — no third card";
    return null;
  }

  function clearAdvance() {
    setCardEntry(emptyCards);
    setActiveSlot(0);
  }

  function addHand(outcome: Outcome, extra?: {
    natural?: boolean; variant?: string; cards?: HandRecord["cards"];
    bankerPair?: boolean; playerPair?: boolean; tieTotal?: number;
  }) {
    const newHand: HandRecord = {
      id: hands.length + 1,
      outcome,
      bankerPair: extra?.bankerPair ?? false,
      playerPair: extra?.playerPair ?? false,
      natural: extra?.natural ?? false,
      variant: extra?.variant,
      cards: extra?.cards,
      tieTotal: extra?.tieTotal,
    };
    setHands(prev => [...prev, newHand]);
    settlePendingBet(newHand);
  }

  // Advance mode: computed live result
  const pTotal = handTotal(cardEntry.player);
  const bTotal = handTotal(cardEntry.banker);
  const cardsEntered = cardEntry.player.slice(0, 2).every(c => c !== null)
    && cardEntry.banker.slice(0, 2).every(c => c !== null);
  const advanceOutcome: Outcome = pTotal > bTotal ? "player" : bTotal > pTotal ? "banker" : "tie";
  const advanceNatural = cardsEntered
    && cardEntry.player[2] === null && cardEntry.banker[2] === null
    && (pTotal >= 8 || bTotal >= 8);
  const advanceError = validateAdvance();

  // Pairs: first two cards of a side matching. Recorded regardless of which
  // side wins — the pair markers on the roads are independent of the outcome.
  const advancePlayerPair = cardEntry.player[0] !== null
    && cardEntry.player[0] === cardEntry.player[1];
  const advanceBankerPair = cardEntry.banker[0] !== null
    && cardEntry.banker[0] === cardEntry.banker[1];

  // Exotic side-bet detection from the entered cards:
  // - Sml/Lge Tiger: Banker wins on a total of 6 with two/three cards
  // - Sml/Big Dragon: Player wins on 7 (two/three cards) v Banker 5 or less
  // - Dragon Tiger: Player 7 beats Banker 6; labelled by total cards (4/5/6)
  const pCardCount = cardEntry.player.filter(c => c !== null).length;
  const bCardCount = cardEntry.banker.filter(c => c !== null).length;
  let advanceVariant: string | undefined;
  if (cardsEntered) {
    if (advanceOutcome === "banker" && bTotal === 6) {
      advanceVariant = bCardCount === 2 ? "sml-tiger" : "lge-tiger";
    } else if (advanceOutcome === "player" && pTotal === 7) {
      if (bTotal === 6) advanceVariant = `dragontiger-${pCardCount + bCardCount}`;
      else if (bTotal <= 5) advanceVariant = pCardCount === 2 ? "sml-dragon" : "big-dragon";
    }
  }
  const VARIANT_LABELS: Record<string, string> = {
    "sml-tiger": "SML TIGER", "lge-tiger": "LGE TIGER",
    "sml-dragon": "SML DRAGON", "big-dragon": "BIG DRAGON",
    "dragontiger-4": "DRAGON TIGER (4 CARD)",
    "dragontiger-5": "DRAGON TIGER (5 CARD)",
    "dragontiger-6": "DRAGON TIGER (6 CARD)",
  };

  function submitAdvanceHand() {
    if (!cardsEntered || advanceError) return;
    addHand(advanceOutcome, {
      natural: advanceNatural,
      playerPair: advancePlayerPair,
      bankerPair: advanceBankerPair,
      variant: advanceVariant,
      tieTotal: advanceOutcome === "tie" ? pTotal : undefined,
      cards: {
        player: cardEntry.player.filter((c): c is string => c !== null),
        banker: cardEntry.banker.filter((c): c is string => c !== null),
      },
    });
    clearAdvance();
  }

  function undoLast() {
    setHands(prev => prev.slice(0, -1));
  }

  return (
    <div className="page">
      {/* Header row */}
      <div className="flex items-center justify-between mb-12">
        <div>
          <div className="page-title">Live Session</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {(details.casino || "Casino not set")}
            {details.gameType ? ` · ${details.gameType}` : ""}
            {` · ${details.commission ? "Commission" : "Non-comm"}`}
            {details.tableNumber ? ` — Table ${details.tableNumber}` : ""}
            {details.shoeNumber ? ` — Shoe ${details.shoeNumber}` : ""}
            {" · "}
            {sessionStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            {" "}
            {sessionStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost" onClick={undoLast} disabled={hands.length === 0}>↩ Undo</button>
          <button className="btn btn-secondary">End Session</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
        {/* Left column — entry + signal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Session details */}
          <div className="panel">
            <button
              className="btn btn-ghost"
              style={{ width: "100%", fontSize: 12, textAlign: "left" }}
              onClick={() => setShowDetails(p => !p)}
            >
              {showDetails ? "▲" : "▼"} Session Details
            </button>
            {showDetails && (() => {
              const casinoCfg = payoutSettings.casinos.find(
                c => c.name.trim().toLowerCase() === details.casino.trim().toLowerCase());
              const usePicker = payoutSettings.casinos.length > 0 && !manualCasino;
              return (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Casino / venue — pick from Settings, or type manually */}
                {usePicker ? (
                  <select
                    className="input"
                    value={casinoCfg ? casinoCfg.name : ""}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === "__other__") {
                        setManualCasino(true);
                        setDetails(d => ({ ...d, casino: "", gameType: "" }));
                        return;
                      }
                      const c = payoutSettings.casinos.find(cc => cc.name === v);
                      const g = c?.games[0];
                      setDetails(d => ({
                        ...d, casino: v, gameType: g?.name ?? "",
                        commission: g ? g.commission : d.commission,
                      }));
                    }}
                  >
                    <option value="" disabled>Select casino / venue</option>
                    {payoutSettings.casinos.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    <option value="__other__">Other (type manually)…</option>
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" placeholder="Casino / venue" style={{ flex: 1 }}
                      value={details.casino}
                      onChange={e => setDetails(d => ({ ...d, casino: e.target.value }))} />
                    {payoutSettings.casinos.length > 0 && (
                      <button className="btn btn-ghost" style={{ fontSize: 12 }}
                        onClick={() => { setManualCasino(false); setDetails(d => ({ ...d, casino: "", gameType: "" })); }}>
                        ▤ List
                      </button>
                    )}
                  </div>
                )}

                {/* Game type — from the casino's configured games, or manual */}
                {casinoCfg && casinoCfg.games.length > 0 && !manualCasino ? (
                  <select
                    className="input"
                    value={details.gameType || casinoCfg.games[0].name}
                    onChange={e => {
                      const g = casinoCfg.games.find(gg => gg.name === e.target.value);
                      setDetails(d => ({
                        ...d, gameType: e.target.value,
                        commission: g ? g.commission : d.commission,
                      }));
                    }}
                  >
                    {casinoCfg.games.map(g => (
                      <option key={g.id} value={g.name}>
                        {g.name} {g.commission ? "(commission)" : "(non-comm)"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input className="input" placeholder="Game type (e.g. Non-Commission)"
                    value={details.gameType}
                    onChange={e => setDetails(d => ({ ...d, gameType: e.target.value }))} />
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input className="input" placeholder="Table no."
                    value={details.tableNumber}
                    onChange={e => setDetails(d => ({ ...d, tableNumber: e.target.value }))} />
                  <input className="input" placeholder="Shoe no."
                    value={details.shoeNumber}
                    onChange={e => setDetails(d => ({ ...d, shoeNumber: e.target.value }))} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input className="input" placeholder="Min bet"
                    value={details.minBet}
                    onChange={e => setDetails(d => ({ ...d, minBet: e.target.value }))} />
                  <input className="input" placeholder="Max bet"
                    value={details.maxBet}
                    onChange={e => setDetails(d => ({ ...d, maxBet: e.target.value }))} />
                </div>
                {([
                  { key: "commission", label: "Commission" },
                  { key: "tiger", label: "Tiger" },
                  { key: "dragon", label: "Dragon" },
                ] as const).map(({ key, label }) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>{label}</span>
                    <button
                      className={`btn ${details[key] ? "btn-secondary" : "btn-ghost"}`}
                      style={{ padding: "4px 14px", fontSize: 12 }}
                      onClick={() => setDetails(d => ({ ...d, [key]: true }))}
                    >
                      Yes
                    </button>
                    <button
                      className={`btn ${!details[key] ? "btn-secondary" : "btn-ghost"}`}
                      style={{ padding: "4px 14px", fontSize: 12 }}
                      onClick={() => setDetails(d => ({ ...d, [key]: false }))}
                    >
                      No
                    </button>
                  </div>
                ))}
                <textarea className="input" placeholder="Notes (table feel, dealer, anything worth remembering)"
                  rows={3} style={{ resize: "vertical" }}
                  value={details.notes}
                  onChange={e => setDetails(d => ({ ...d, notes: e.target.value }))} />
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Date &amp; start time recorded automatically
                </div>
              </div>
              );
            })()}
          </div>

          {/* My Bet — pay engine */}
          <div className="panel">
            <div className="flex items-center justify-between" style={{ gap: 8 }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, textAlign: "left", flexShrink: 0 }}
                onClick={() => setShowBets(p => !p)}
              >
                {showBets ? "▲" : "▼"} My Bets
              </button>
              <span className="bet-header-stats">
                <span>
                  P/(L):{" "}
                  <b className={`ledger-pl ${ledger.returned - ledger.staked >= 0 ? "up" : "down"}`} style={{ fontSize: 12 }}>
                    {ledger.returned - ledger.staked > 0
                      ? `+${ledger.returned - ledger.staked}`
                      : ledger.returned - ledger.staked < 0
                      ? `(${Math.abs(ledger.returned - ledger.staked)})`
                      : "0"}
                  </b>
                </span>
                <span>
                  Bets:{" "}
                  <b style={{ color: "var(--text-primary)" }}>
                    {ledger.betHands === 0
                      ? "0"
                      : `${ledger.wonHands} (W) - ${ledger.betHands - ledger.wonHands} (L)`}
                  </b>
                </span>
              </span>
            </div>
            {showBets && (
              <div style={{ marginTop: 10 }}>
                {/* Main bet: Banker / Player / amount (chips stack into it) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                  {(["banker", "player"] as const).map(s => (
                    <button
                      key={s}
                      className={`btn bet-side-btn ${s} ${pendingMain === s ? "selected" : ""}`}
                      onClick={() => setPendingMain(m => (m === s ? null : s))}
                    >
                      {s === "banker" ? "庄 B" : "闲 P"}
                    </button>
                  ))}
                  <span className={`amount-wrap${pendingStake > 0 ? " has-value" : ""}`}>
                    <span className="amount-prefix">$</span>
                    <input
                      className="input amount-input"
                      type="number" min={1} placeholder="Amount $"
                      value={pendingStake > 0 ? pendingStake : ""}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        setPendingStake(isNaN(v) || v <= 0 ? 0 : v);
                      }}
                    />
                  </span>
                </div>

                {/* Casino chips — each press adds to the amount, like stacking chips */}
                <div className="chip-row">
                  {STAKE_PRESETS.map(v => (
                    <button
                      key={v}
                      className={`bet-chip chip-${v}`}
                      onClick={() => setPendingStake(s => s + v)}
                    >
                      <span className="chip-label">${v >= 1000 ? `${v / 1000}k` : v}</span>
                    </button>
                  ))}
                </div>

                {/* Slip summary + actions */}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11 }} disabled={!lastSlip} onClick={repeatLastBet}>
                    ↻ Re-bet
                  </button>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11 }} disabled={!hasPendingBet && !hasPendingCall} onClick={clearPendingBet}>
                    ✕ Clear
                  </button>
                </div>
                <div style={{ fontSize: 11, marginTop: 6, color: hasPendingBet || hasPendingCall ? "var(--gold)" : "var(--text-muted)" }}>
                  {hasPendingBet
                    ? `Bet pending: ${totalStake(pendingSlip)} — settles when the result is recorded`
                    : hasPendingCall
                    ? `Call pending: ${pendingMain === "banker" ? "Banker" : "Player"} (no money) — records when the result is entered`
                    : "To bet or call - tap Banker/Player & amount (optional)"}
                </div>

                {/* Last settlement (money bet) or call result */}
                {lastSettlement ? (
                  <div
                    className="settlement-flash"
                    style={{
                      borderColor: lastSettlement.profit >= 0 ? "var(--tie-green)" : "var(--banker-red)",
                      padding: "5px 10px", fontSize: 12,
                    }}
                  >
                    Last Bet: Game {lastGame} —{" "}
                    <b style={{ color: lastSettlement.profit >= 0 ? "var(--tie-green)" : "var(--banker-red)" }}>
                      {lastSettlement.profit >= 0
                        ? `Bet Win (+ ${lastSettlement.profit})`
                        : `Bet Lose (- ${Math.abs(lastSettlement.profit)})`}
                    </b>
                  </div>
                ) : lastCall && (
                  <div
                    className="settlement-flash"
                    style={{
                      borderColor: lastCall.result === "win" ? "var(--tie-green)" : lastCall.result === "loss" ? "var(--banker-red)" : "var(--border-panel)",
                      padding: "5px 10px", fontSize: 12,
                    }}
                  >
                    Last Call: Game {lastGame} — {lastCall.side === "banker" ? "Banker" : "Player"}{" "}
                    <b style={{ color: lastCall.result === "win" ? "var(--tie-green)" : lastCall.result === "loss" ? "var(--banker-red)" : "var(--text-secondary)" }}>
                      {lastCall.result === "win" ? "WIN" : lastCall.result === "loss" ? "LOSE" : "TIE — push"}
                    </b>
                  </div>
                )}

                {/* Side bets — bottom of the panel */}
                <button
                  className="btn btn-ghost"
                  style={{ width: "100%", fontSize: 11, marginTop: 8, marginBottom: sideBetMode ? 8 : 0 }}
                  onClick={() => setSideBetMode(p => !p)}
                >
                  {sideBetMode ? "▲ Hide side bets" : "▼ Side bets"}
                </button>
                {sideBetMode && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {([
                      ["tie", "Tie"],
                      ["bPair", "B Pair"], ["pPair", "P Pair"],
                      ["anyPair", "Any Pair"], ["anyTiger", "Any Tiger"],
                      ["smlTiger", "Sml Tiger"], ["bigTiger", "Big Tiger"],
                      ["smlDragon", "Sml Dragon"], ["bigDragon", "Big Dragon"],
                      ["tigerTie", "Tiger Tie"], ["dragonTie", "Dragon Tie"],
                      ["dragonTiger", "D-Tiger"],
                    ] as [SideBetType, string][]).map(([type, label]) => (
                      <div key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", width: 62, flexShrink: 0 }}>{label}</span>
                        <input
                          className="input"
                          type="number" min={0} placeholder="stake"
                          style={{ padding: "4px 6px", fontSize: 11, minWidth: 0 }}
                          value={pendingSides[type] ?? ""}
                          onChange={e => {
                            const v = parseInt(e.target.value, 10);
                            setPendingSides(p => ({ ...p, [type]: isNaN(v) || v <= 0 ? undefined : v }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Big entry buttons */}
          <div className="panel" style={{ position: "relative" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8, position: "relative" }}>
              <div className="panel-title" style={{ marginBottom: 0 }}>Record Result</div>
              <span
                className="game-indicator"
                style={{ position: "absolute", left: "50%", transform: "translateX(-50%)" }}
              >
                Game {hands.length + 1}
              </span>
              <button
                className="info-icon"
                title="How this works"
                onClick={() => setShowRecordInfo(true)}
              >
                i
              </button>
            </div>

            {/* Info popup */}
            {showRecordInfo && (
              <div className="info-overlay" onClick={() => setShowRecordInfo(false)}>
                <div className="info-popup" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Recording Results</div>
                    <button className="info-close" onClick={() => setShowRecordInfo(false)}>✕</button>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                    <p style={{ margin: "0 0 8px" }}>
                      Record each hand as it finishes. You can switch mode at any time,
                      hand by hand — use whichever suits the pace of the game.
                    </p>
                    <p style={{ margin: "0 0 4px" }}>
                      <strong style={{ color: "var(--text-primary)" }}>BASIC</strong> — one tap:
                      Banker, Player, their Naturals, or Tie.
                    </p>
                    <p style={{ margin: "0 0 4px" }}>
                      <strong style={{ color: "var(--text-primary)" }}>MEDIUM</strong> — adds exotic
                      results: Tigers (Banker wins on 6), Dragons and DragonTiger variants.
                    </p>
                    <p style={{ margin: "0 0 8px" }}>
                      <strong style={{ color: "var(--text-primary)" }}>ADVANCE</strong> — enter the
                      actual card values on the keypad in deal order. The winner is
                      calculated for you; check it matches the table, then press OK.
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                      All modes feed the same roads — extra detail is stored on the hand
                      for later analysis. Made a mistake? Use Undo or Edit a Game Result.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Mode selector */}
            <div className="mode-tabs">
              {(["basic", "medium", "advance"] as const).map(m => (
                <button
                  key={m}
                  className={`mode-tab ${entryMode === m ? "active" : ""}`}
                  onClick={() => setEntryMode(m)}
                >
                  {m === "basic" ? "BASIC" : m === "medium" ? "MEDIUM" : "ADVANCE"}
                </button>
              ))}
            </div>

            {/* Mode 1 — BASIC */}
            {entryMode === "basic" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button className="btn btn-banker" onClick={() => addHand("banker")}>庄 BANKER</button>
                  <button className="btn btn-banker" style={{ fontSize: 12 }} onClick={() => addHand("banker", { natural: true })}>
                    BANKER<br />Natural (8/9)
                  </button>
                  <button className="btn btn-player" onClick={() => addHand("player")}>闲 PLAYER</button>
                  <button className="btn btn-player" style={{ fontSize: 12 }} onClick={() => addHand("player", { natural: true })}>
                    PLAYER<br />Natural (8/9)
                  </button>
                </div>
                <button className="btn btn-tie" style={{ padding: "8px 0" }} onClick={() => addHand("tie")}>和 TIE</button>
              </div>
            )}

            {/* Mode 2 — MEDIUM */}
            {entryMode === "medium" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button className="btn btn-banker medium-btn" onClick={() => addHand("banker")}>庄 BANKER</button>
                  <button className="btn btn-banker medium-btn" onClick={() => addHand("banker", { natural: true })}>BANKER<br /><span className="medium-sub">Natural (8/9)</span></button>
                  <button className="btn btn-banker medium-btn" onClick={() => addHand("banker", { variant: "sml-tiger" })}>BANKER<br /><span className="medium-sub">Sml Tiger</span></button>
                  <button className="btn btn-banker medium-btn" onClick={() => addHand("banker", { variant: "lge-tiger" })}>BANKER<br /><span className="medium-sub">Lge Tiger</span></button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button className="btn btn-player medium-btn" onClick={() => addHand("player")}>闲 PLAYER</button>
                  <button className="btn btn-player medium-btn" onClick={() => addHand("player", { natural: true })}>PLAYER<br /><span className="medium-sub">Natural (8/9)</span></button>
                  <button className="btn btn-player medium-btn" onClick={() => addHand("player", { variant: "sml-dragon" })}>PLAYER<br /><span className="medium-sub">Sml Dragon</span></button>
                  <button className="btn btn-player medium-btn" onClick={() => addHand("player", { variant: "big-dragon" })}>PLAYER<br /><span className="medium-sub">Big Dragon</span></button>
                  <button className="btn btn-player medium-btn" onClick={() => addHand("player", { variant: "dragontiger-4" })}>PLAYER<br /><span className="medium-sub small">DragonTiger (4 Card)</span></button>
                  <button className="btn btn-player medium-btn" onClick={() => addHand("player", { variant: "dragontiger-5" })}>PLAYER<br /><span className="medium-sub small">DragonTiger (5 Card)</span></button>
                  <button className="btn btn-player medium-btn" style={{ gridColumn: "1 / -1" }} onClick={() => addHand("player", { variant: "dragontiger-6" })}>PLAYER<br /><span className="medium-sub small">DragonTiger (6 Card)</span></button>
                </div>
                <button className="btn btn-tie" style={{ padding: "8px 0" }} onClick={() => addHand("tie")}>和 TIE</button>
              </div>
            )}

            {/* Mode 3 — ADVANCE: one-touch keypad entry */}
            {entryMode === "advance" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {/* Card slots — tap a slot to redirect the next keypad tap */}
                {(["player", "banker"] as const).map(side => (
                  <div key={side}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5, color: side === "banker" ? "var(--banker-red)" : "var(--player-blue)" }}>
                      {side === "banker" ? "庄 Banker" : "闲 Player"}
                      <span style={{ marginLeft: 8, color: "var(--text-secondary)", fontWeight: 400 }}>
                        total: {handTotal(cardEntry[side])}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                      {[0, 1, 2].map(i => {
                        const slotIdx = SLOT_ORDER.findIndex(s => s.side === side && s.idx === i);
                        const isActive = slotIdx === activeSlot;
                        const val = cardEntry[side][i];
                        const enabled = val !== null || slotEnabled(side, i);
                        const bothIn = cardEntry[side][0] !== null && cardEntry[side][1] !== null;
                        return (
                          <button
                            key={i}
                            className="card-slot"
                            data-active={(isActive && enabled) || undefined}
                            data-side={side}
                            disabled={!enabled}
                            onClick={() => setActiveSlot(slotIdx)}
                          >
                            {val !== null ? val : (
                              <span style={{ opacity: 0.45, fontSize: 12, fontWeight: 500 }}>
                                {i === 2 && bothIn && !enabled ? "Stand" : `Card ${i + 1}`}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* One-touch rank keypad: A, 2–10, J, Q, K */}
                <div className="keypad ranks">
                  {RANKS.map(r => (
                    <button key={r} className="keypad-btn" onClick={() => tapCardValue(r)}>{r}</button>
                  ))}
                </div>
                <button className="btn btn-ghost" style={{ padding: "6px 0", fontSize: 12 }} onClick={clearAdvance}>
                  ✕ Clear cards
                </button>

                {/* Computed result preview */}
                <div className="panel" style={{ background: "var(--bg-dark)", padding: 10, textAlign: "center" }}>
                  {cardsEntered ? (
                    <span style={{ fontWeight: 700, fontSize: 15 }}>
                      <span style={{
                        color: advanceOutcome === "banker" ? "var(--banker-red)" : advanceOutcome === "player" ? "var(--player-blue)" : "var(--tie-green)",
                      }}>
                        {advanceOutcome === "banker" ? "庄 Banker Wins" : advanceOutcome === "player" ? "闲 Player Wins" : "和 Tie"}
                      </span>
                      {" "}
                      {advanceOutcome === "tie" ? (
                        <span style={{ color: "var(--tie-green)" }}>{bTotal} v {pTotal}</span>
                      ) : advanceOutcome === "banker" ? (
                        <>
                          <span style={{ color: "var(--banker-red)" }}>{bTotal}</span>
                          <span style={{ color: "var(--text-secondary)" }}> v </span>
                          <span style={{ color: "var(--player-blue)" }}>{pTotal}</span>
                        </>
                      ) : (
                        <>
                          <span style={{ color: "var(--player-blue)" }}>{pTotal}</span>
                          <span style={{ color: "var(--text-secondary)" }}> v </span>
                          <span style={{ color: "var(--banker-red)" }}>{bTotal}</span>
                        </>
                      )}
                      {advanceNatural && <span style={{ color: "var(--gold)" }}> · NATURAL</span>}
                      {advanceVariant && <span style={{ color: "var(--gold)" }}> · {VARIANT_LABELS[advanceVariant] ?? advanceVariant}</span>}
                      {advancePlayerPair && <span style={{ color: "var(--player-blue)" }}> · P PAIR</span>}
                      {advanceBankerPair && <span style={{ color: "var(--banker-red)" }}> · B PAIR</span>}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Enter both first two cards to see the result</span>
                  )}
                  {advanceError && (
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: "var(--signal-amber)" }}>
                      ⚠ {advanceError}
                    </div>
                  )}
                </div>
                <button className="btn btn-secondary" disabled={!cardsEntered || !!advanceError} onClick={submitAdvanceHand}>
                  OK — Record Hand
                </button>
              </div>
            )}

          </div>

          {/* Correction bar */}
          <div className="panel">
            <button
              className="btn btn-ghost"
              style={{ width: "100%", fontSize: 12, textAlign: "left" }}
              onClick={() => setShowFix(p => !p)}
            >
              {showFix ? "▲" : "▼"} Edit a Game Result
            </button>
            {showFix && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 8 }}>
                <input
                  className="input" type="number" min={1} placeholder="Game #"
                  value={fixGameNo}
                  onChange={e => setFixGameNo(e.target.value)}
                />
                <select className="input" value={fixAction}
                  onChange={e => setFixAction(e.target.value as typeof fixAction)}>
                  <option value="change">Change result</option>
                  <option value="insert">Insert result</option>
                  <option value="delete">Delete result</option>
                </select>
              </div>
              {fixAction !== "delete" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {(["banker", "player", "tie"] as const).map(o => (
                    <button
                      key={o}
                      className={`btn ${fixOutcome === o ? `btn-${o}` : "btn-ghost"}`}
                      style={{ padding: "6px 0", fontSize: 12 }}
                      onClick={() => setFixOutcome(o)}
                    >
                      {o === "banker" ? "B" : o === "player" ? "P" : "T"}
                    </button>
                  ))}
                </div>
              )}
              <button
                className="btn btn-secondary"
                onClick={applyCorrection}
                disabled={!fixGameNo}
              >
                Apply
              </button>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Delete removes that game and moves everything after it back one.
                Insert pushes everything from that game forward one.
              </div>
            </div>
            )}
          </div>

          {/* Comment assistant */}
          <div className="panel">
            <div className="panel-title">Assistant</div>
            <div style={{
              padding: "10px 12px", borderRadius: "var(--radius-md)", fontSize: 12,
              background: assistant.tone === "good" ? "rgba(0,200,83,0.08)"
                : assistant.tone === "warn" ? "rgba(245,200,66,0.07)" : "var(--bg-dark)",
              border: `1px solid ${assistant.tone === "good" ? "var(--tie-green)"
                : assistant.tone === "warn" ? "var(--gold)" : "var(--border-panel)"}`,
            }}>
              <div style={{
                fontWeight: 700, fontSize: 13, marginBottom: 4,
                color: assistant.tone === "good" ? "var(--tie-green)"
                  : assistant.tone === "warn" ? "var(--gold)" : "var(--text-primary)",
              }}>
                {assistant.title}
              </div>
              <div style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>{assistant.detail}</div>
            </div>
          </div>

          {/* Entity strip — live engine reads per profile */}
          <div className="panel">
            <div className="panel-title">Next Hand Calls</div>
            <div className="entity-strip">
              {([
                ["You", signals.you],
                ["Sniper", signals.sniper],
                ["Grinder", signals.grinder],
              ] as const).map(([name, sig]) => (
                <div key={name} className="entity-card">
                  <div className="entity-name">{name}</div>
                  {sig === null ? (
                    <div className="entity-call none">–</div>
                  ) : sig.window ? (
                    <>
                      <div className={`entity-call ${sig.predictedSide}`}>
                        {sig.predictedSide === "banker" ? "B" : "P"}
                      </div>
                      <div className="entity-conf">{sig.confidence}%</div>
                      <div className="conf-bar">
                        <div
                          className={`conf-fill ${sig.predictedSide}`}
                          style={{ width: `${sig.confidence}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="entity-call none" style={{ fontSize: 15 }}>SIT</div>
                      <div className="entity-conf" style={{ color: "var(--text-muted)" }}>
                        {sig.alignment}/3
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {!signals.you && (
              <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                Signals activate once a few hands are recorded
              </div>
            )}
          </div>

          {/* Road alignment (You profile) */}
          {(() => {
            const sig = signals.you;
            const roads: { name: string; cn: string; vote: RoadVote }[] = sig
              ? [
                  { name: "Big Eye Boy", cn: "大眼仔", vote: sig.roadVotes[0] },
                  { name: "Small Road", cn: "小路", vote: sig.roadVotes[1] },
                  { name: "Cockroach", cn: "曱甴路", vote: sig.roadVotes[2] },
                ]
              : [];
            return (
              <div className="panel">
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <div className="panel-title" style={{ marginBottom: 0 }}>Road Alignment</div>
                  {sig && (
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999,
                      color: sig.alignment >= 2 ? "var(--tie-green)" : "var(--text-secondary)",
                      border: `1px solid ${sig.alignment >= 2 ? "var(--tie-green)" : "var(--border-panel)"}`,
                    }}>
                      {sig.alignment}/3 aligned
                    </span>
                  )}
                </div>
                {!sig && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Record hands to open the road reads
                  </div>
                )}
                {sig && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {roads.map(r => (
                      <div key={r.name} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        fontSize: 12, padding: "4px 8px", borderRadius: "var(--radius-sm)",
                        background: "var(--bg-dark)",
                      }}>
                        <span style={{
                          fontWeight: 700, width: 14, textAlign: "center",
                          color: r.vote === "aligned" ? "var(--tie-green)"
                            : r.vote === "against" ? "var(--banker-red)" : "var(--text-muted)",
                        }}>
                          {r.vote === "aligned" ? "✓" : r.vote === "against" ? "✗" : "–"}
                        </span>
                        <span style={{ color: "var(--text-secondary)", flex: 1 }}>
                          {r.name} <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{r.cn}</span>
                        </span>
                        <span style={{
                          fontSize: 11,
                          color: r.vote === "aligned" ? "var(--tie-green)"
                            : r.vote === "against" ? "var(--banker-red)" : "var(--text-muted)",
                        }}>
                          {r.vote === "aligned" ? "Aligned" : r.vote === "against" ? "Against" : "No read"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

        </div>

        {/* Right column — roads */}
        <div>
          <RoadsDisplay
            outcomes={outcomes}
            extras={hands.map(h => ({
              natural: h.natural,
              bankerPair: h.bankerPair,
              playerPair: h.playerPair,
              variant: h.variant,
              tieTotal: h.tieTotal,
              betResult: h.betResult,
            }))}
            screenId={liveScreenId}
          />
        </div>
      </div>
    </div>
  );
}
