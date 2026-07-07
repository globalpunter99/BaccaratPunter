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

export default function LiveSession() {
  const [hands, setHands] = useState<HandRecord[]>([]);
  const [sessionName] = useState("Crown Melbourne — Table 3");
  const [showPairNatural, setShowPairNatural] = useState(false);
  const [pendingFlags, setPendingFlags] = useState({ bankerPair: false, playerPair: false, natural: false });

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

  function addGap() {
    // In full version: mark a gap in the shoe
    alert("Gap marker added — hands missed in this section will be excluded from analysis.");
  }

  const bankerCount = hands.filter(h => h.outcome === "banker").length;
  const playerCount = hands.filter(h => h.outcome === "player").length;
  const tieCount    = hands.filter(h => h.outcome === "tie").length;

  return (
    <div className="page">
      {/* Header row */}
      <div className="flex items-center justify-between mb-12">
        <div>
          <div className="page-title">Live Session</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{sessionName}</div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-ghost" onClick={addGap}>⚠ Gap</button>
          <button className="btn btn-ghost" onClick={undoLast} disabled={hands.length === 0}>↩ Undo</button>
          <button className="btn btn-secondary">End Session</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
        {/* Left column — entry + signal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Hand counter */}
          <div className="panel">
            <div className="flex justify-between items-center">
              <div>
                <div className="hand-number">{hands.length}</div>
                <div className="hand-label">Hands Played</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 13 }}>
                <div><span className="text-red fw-600">B {bankerCount}</span></div>
                <div><span className="text-blue fw-600">P {playerCount}</span></div>
                <div><span className="text-green fw-600">T {tieCount}</span></div>
              </div>
            </div>
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

          {/* Recent hands */}
          {hands.length > 0 && (
            <div className="panel">
              <div className="panel-title">Recent Hands</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {hands.slice(-20).map(h => (
                  <span
                    key={h.id}
                    className={`badge badge-${h.outcome === "banker" ? "banker" : h.outcome === "player" ? "player" : "tie"}`}
                  >
                    {h.outcome === "banker" ? "B" : h.outcome === "player" ? "P" : "T"}
                    {h.bankerPair || h.playerPair ? "★" : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column — roads */}
        <div>
          {hands.length === 0 ? (
            <div className="panel" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🎴</div>
              <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
                Roads will appear as you record hands
              </div>
            </div>
          ) : (
            <RoadsDisplay outcomes={outcomes} />
          )}
        </div>
      </div>
    </div>
  );
}
