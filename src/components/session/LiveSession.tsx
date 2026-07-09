import { useState } from "react";
import type { Outcome } from "../../game/baccarat";
import RoadsDisplay from "../roads/RoadsDisplay";
import { mockSignal } from "../../mock/data";

interface HandRecord {
  id: number;
  outcome: Outcome;
  bankerPair: boolean;
  playerPair: boolean;
  natural: boolean;
  // Exotic result variant (medium/advance modes): sml-tiger, lge-tiger,
  // sml-dragon, big-dragon, dragontiger-3, dragontiger-4, dragontiger-5
  variant?: string;
  // Advance mode: raw card values as entered (banker/player, up to 3 each)
  cards?: { player: number[]; banker: number[] };
}

type EntryMode = "basic" | "medium" | "advance";
type CardSlot = number | null;

// Baccarat card value: 10/J/Q/K count 0; entry uses 0–10 where 10 → 0.
const cardVal = (v: number) => v % 10;

function handTotal(cards: CardSlot[]): number {
  return cards.reduce<number>((sum, c) => (c === null ? sum : (sum + cardVal(c)) % 10), 0);
}

interface SessionDetails {
  casino: string;
  tableNumber: string;
  shoeNumber: string;
  minBet: string;
  maxBet: string;
  notes: string;
  // Commission baccarat: 5% commission on winning Banker bets.
  // Non-commission: Banker win on a total of 6 (big/small tiger) pays
  // the Banker bet at 50%.
  commission: boolean;
}

export default function LiveSession() {
  const [hands, setHands] = useState<HandRecord[]>([]);

  // Session details — date/time recorded automatically at session start
  const [sessionStart] = useState(() => new Date());
  const [details, setDetails] = useState<SessionDetails>({
    casino: "", tableNumber: "", shoeNumber: "", minBet: "", maxBet: "", notes: "", commission: true,
  });
  const [showDetails, setShowDetails] = useState(false);
  const [showFix, setShowFix] = useState(false);
  const [showRecordInfo, setShowRecordInfo] = useState(false);

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
  const signal = mockSignal;

  // Entry mode + advance-mode card slots
  const [entryMode, setEntryMode] = useState<EntryMode>("basic");
  const emptyCards: { player: CardSlot[]; banker: CardSlot[] } = {
    player: [null, null, null], banker: [null, null, null],
  };
  const [cardEntry, setCardEntry] = useState(emptyCards);

  // Advance mode: which slot the next keypad tap fills.
  // Natural fill order follows the deal: P1, B1, P2, B2, then thirds P3, B3.
  const SLOT_ORDER: { side: "player" | "banker"; idx: number }[] = [
    { side: "player", idx: 0 }, { side: "banker", idx: 0 },
    { side: "player", idx: 1 }, { side: "banker", idx: 1 },
    { side: "player", idx: 2 }, { side: "banker", idx: 2 },
  ];
  const [activeSlot, setActiveSlot] = useState(0);

  function tapCardValue(v: number) {
    if (activeSlot >= SLOT_ORDER.length) return;
    const { side, idx } = SLOT_ORDER[activeSlot];
    setCardEntry(prev => {
      const next = { ...prev, [side]: [...prev[side]] };
      next[side][idx] = v;
      return next;
    });
    setActiveSlot(s => Math.min(s + 1, SLOT_ORDER.length));
  }

  function clearAdvance() {
    setCardEntry(emptyCards);
    setActiveSlot(0);
  }

  function addHand(outcome: Outcome, extra?: { natural?: boolean; variant?: string; cards?: HandRecord["cards"] }) {
    const newHand: HandRecord = {
      id: hands.length + 1,
      outcome,
      bankerPair: false,
      playerPair: false,
      natural: extra?.natural ?? false,
      variant: extra?.variant,
      cards: extra?.cards,
    };
    setHands(prev => [...prev, newHand]);
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

  function submitAdvanceHand() {
    if (!cardsEntered) return;
    addHand(advanceOutcome, {
      natural: advanceNatural,
      cards: {
        player: cardEntry.player.filter((c): c is number => c !== null),
        banker: cardEntry.banker.filter((c): c is number => c !== null),
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
            {details.tableNumber ? ` — Table ${details.tableNumber}` : ""}
            {details.shoeNumber ? ` — Shoe ${details.shoeNumber}` : ""}
            {" · "}{sessionStart.toLocaleDateString()} {sessionStart.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
            {showDetails && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <input className="input" placeholder="Casino / venue"
                  value={details.casino}
                  onChange={e => setDetails(d => ({ ...d, casino: e.target.value }))} />
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
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                    Commission baccarat?
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <button
                      className={`btn ${details.commission ? "btn-secondary" : "btn-ghost"}`}
                      style={{ padding: "7px 0", fontSize: 12 }}
                      onClick={() => setDetails(d => ({ ...d, commission: true }))}
                    >
                      Yes
                    </button>
                    <button
                      className={`btn ${!details.commission ? "btn-secondary" : "btn-ghost"}`}
                      style={{ padding: "7px 0", fontSize: 12 }}
                      onClick={() => setDetails(d => ({ ...d, commission: false }))}
                    >
                      No
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>
                    {details.commission
                      ? "5% commission applies on winning Banker bets"
                      : "No commission — Banker win on a total of 6 (big/small tiger) pays Banker bets at 50%"}
                  </div>
                </div>
                <textarea className="input" placeholder="Notes (table feel, dealer, anything worth remembering)"
                  rows={3} style={{ resize: "vertical" }}
                  value={details.notes}
                  onChange={e => setDetails(d => ({ ...d, notes: e.target.value }))} />
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Date &amp; start time recorded automatically
                </div>
              </div>
            )}
          </div>

          {/* Big entry buttons */}
          <div className="panel" style={{ position: "relative" }}>
            <div className="flex items-center justify-between">
              <div className="panel-title">Record Result</div>
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
                    BANKER<br />NATURAL
                  </button>
                  <button className="btn btn-player" onClick={() => addHand("player")}>闲 PLAYER</button>
                  <button className="btn btn-player" style={{ fontSize: 12 }} onClick={() => addHand("player", { natural: true })}>
                    PLAYER<br />NATURAL
                  </button>
                </div>
                <button className="btn btn-tie" style={{ padding: "8px 0" }} onClick={() => addHand("tie")}>和 TIE</button>
              </div>
            )}

            {/* Mode 2 — MEDIUM */}
            {entryMode === "medium" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button className="btn btn-banker" onClick={() => addHand("banker")}>庄 BANKER</button>
                  <button className="btn btn-banker" style={{ fontSize: 11 }} onClick={() => addHand("banker", { natural: true })}>BANKER NATURAL</button>
                  <button className="btn btn-banker" style={{ fontSize: 11 }} onClick={() => addHand("banker", { variant: "sml-tiger" })}>BANKER SML TIGER</button>
                  <button className="btn btn-banker" style={{ fontSize: 11 }} onClick={() => addHand("banker", { variant: "lge-tiger" })}>BANKER LGE TIGER</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <button className="btn btn-player" onClick={() => addHand("player")}>闲 PLAYER</button>
                  <button className="btn btn-player" style={{ fontSize: 11 }} onClick={() => addHand("player", { natural: true })}>PLAYER NATURAL</button>
                  <button className="btn btn-player" style={{ fontSize: 11 }} onClick={() => addHand("player", { variant: "sml-dragon" })}>PLAYER SML DRAGON</button>
                  <button className="btn btn-player" style={{ fontSize: 11 }} onClick={() => addHand("player", { variant: "big-dragon" })}>PLAYER BIG DRAGON</button>
                  <button className="btn btn-player" style={{ fontSize: 11 }} onClick={() => addHand("player", { variant: "dragontiger-3" })}>P DRAGONTIGER (3 CARD)</button>
                  <button className="btn btn-player" style={{ fontSize: 11 }} onClick={() => addHand("player", { variant: "dragontiger-4" })}>P DRAGONTIGER (4 CARD)</button>
                  <button className="btn btn-player" style={{ fontSize: 11, gridColumn: "1 / -1" }} onClick={() => addHand("player", { variant: "dragontiger-5" })}>P DRAGONTIGER (5 CARD)</button>
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
                        return (
                          <button
                            key={i}
                            className="card-slot"
                            data-active={isActive || undefined}
                            data-side={side}
                            onClick={() => setActiveSlot(slotIdx)}
                          >
                            {val !== null ? val : <span style={{ opacity: 0.45 }}>{i === 2 ? "3rd" : `C${i + 1}`}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* One-touch 0–9 keypad */}
                <div className="keypad">
                  {Array.from({ length: 10 }, (_, v) => (
                    <button key={v} className="keypad-btn" onClick={() => tapCardValue(v)}>{v}</button>
                  ))}
                </div>
                <button className="btn btn-ghost" style={{ padding: "6px 0", fontSize: 12 }} onClick={clearAdvance}>
                  ✕ Clear cards
                </button>

                {/* Computed result preview */}
                <div className="panel" style={{ background: "var(--bg-dark)", padding: 10, textAlign: "center" }}>
                  {cardsEntered ? (
                    <>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Result: </span>
                      <span style={{
                        fontWeight: 700, fontSize: 15,
                        color: advanceOutcome === "banker" ? "var(--banker-red)" : advanceOutcome === "player" ? "var(--player-blue)" : "var(--tie-green)",
                      }}>
                        {advanceOutcome === "banker" ? "庄 BANKER" : advanceOutcome === "player" ? "闲 PLAYER" : "和 TIE"}
                        {" "}{bTotal}–{pTotal}
                        {advanceNatural ? " · NATURAL" : ""}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Enter both first two cards to see the result</span>
                  )}
                </div>
                <button className="btn btn-secondary" disabled={!cardsEntered} onClick={submitAdvanceHand}>
                  OK — Submit Hand
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

          {/* Playability signal */}
          <div className="panel">
            <div className="panel-title">Window Status</div>
            <div className={`signal-band ${signal.playability}`}>
              <div className={`signal-dot ${signal.playability}`} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{signal.playabilityLabel}</div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>
                  {signal.playability === "green"
                    ? "Roads are aligned — favourable window"
                    : signal.playability === "amber"
                    ? "Pattern forming — watch closely"
                    : "Roads unclear — sit out recommended"}
                </div>
              </div>
            </div>
          </div>

          {/* Entity strip */}
          <div className="panel">
            <div className="panel-title">Next Hand Calls</div>
            <div className="entity-strip">
              {[
                { name: "You", call: signal.you },
                { name: "Sniper", call: signal.sniper },
                { name: "Grinder", call: signal.grinder },
              ].map(({ name, call }) => (
                <div key={name} className="entity-card">
                  <div className="entity-name">{name}</div>
                  {call ? (
                    <>
                      <div className={`entity-call ${call.side}`}>
                        {call.side === "banker" ? "B" : "P"}
                      </div>
                      <div className="entity-conf">{call.confidence}%</div>
                      <div className="conf-bar">
                        <div
                          className={`conf-fill ${call.side}`}
                          style={{ width: `${call.confidence}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="entity-call none">–</div>
                  )}
                </div>
              ))}
            </div>
            {hands.length < 10 && (
              <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                Enter at least 10 hands to activate signals
              </div>
            )}
          </div>

        </div>

        {/* Right column — roads */}
        <div>
          <RoadsDisplay outcomes={outcomes} />
        </div>
      </div>
    </div>
  );
}
