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
  const [showPairNatural, setShowPairNatural] = useState(false);
  const [pendingFlags, setPendingFlags] = useState({ bankerPair: false, playerPair: false, natural: false });

  // Session details — date/time recorded automatically at session start
  const [sessionStart] = useState(() => new Date());
  const [details, setDetails] = useState<SessionDetails>({
    casino: "", tableNumber: "", shoeNumber: "", minBet: "", maxBet: "", notes: "", commission: true,
  });
  const [showDetails, setShowDetails] = useState(false);

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

  function addHand(outcome: Outcome) {
    const newHand: HandRecord = {
      id: hands.length + 1,
      outcome,
      ...pendingFlags,
    };
    setHands(prev => [...prev, newHand]);
    setPendingFlags({ bankerPair: false, playerPair: false, natural: false });
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
          <div className="panel">
            <div className="panel-title">Record Result</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="btn btn-banker" onClick={() => addHand("banker")}>
                庄 &nbsp; BANKER
              </button>
              <button className="btn btn-player" onClick={() => addHand("player")}>
                闲 &nbsp; PLAYER
              </button>
              <button className="btn btn-tie" onClick={() => addHand("tie")}>
                和 &nbsp; TIE
              </button>
            </div>

            <div className="divider" />

            {/* Optional flags */}
            <button
              className="btn btn-ghost"
              style={{ width: "100%", fontSize: 12 }}
              onClick={() => setShowPairNatural(p => !p)}
            >
              {showPairNatural ? "▲" : "▼"} Pairs / Natural flags
            </button>

            {showPairNatural && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {(["bankerPair", "playerPair", "natural"] as const).map(flag => (
                  <label key={flag} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={pendingFlags[flag]}
                      onChange={e => setPendingFlags(p => ({ ...p, [flag]: e.target.checked }))}
                    />
                    <span style={{ color: "var(--text-secondary)" }}>
                      {flag === "bankerPair" ? "Banker Pair" : flag === "playerPair" ? "Player Pair" : "Natural (8/9)"}
                    </span>
                  </label>
                ))}
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Flags apply to the next hand entered
                </div>
              </div>
            )}
          </div>

          {/* Correction bar */}
          <div className="panel">
            <div className="panel-title">Fix a Result</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
