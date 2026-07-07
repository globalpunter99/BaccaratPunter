import { useState } from "react";
import { mockSessions } from "../../mock/data";
import type { Session } from "../../mock/data";
import RoadsDisplay from "../roads/RoadsDisplay";
import type { Outcome } from "../../game/baccarat";

export default function ShoeReplay() {
  const [session, setSession] = useState<Session | null>(null);
  const [handIdx, setHandIdx] = useState(0);
  const [_playing, _setPlaying] = useState(false); // reserved for auto-play feature

  if (!session) {
    return (
      <div className="page" style={{ maxWidth: 700 }}>
        <div className="page-title">Shoe Replay</div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
          Step through any recorded session hand by hand. See how the roads built up over time,
          and review what signals were present at each point in the shoe.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mockSessions.map(s => (
            <div
              key={s.id}
              className="panel"
              style={{ cursor: "pointer" }}
              onClick={() => { setSession(s); setHandIdx(0); }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-accent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-panel)")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontWeight: 600 }}>{s.venue}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {s.tableNumber} · {s.date} · {s.hands.length} hands
                  </div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }}>
                  Replay ▶
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const visibleOutcomes: Outcome[] = session.hands.slice(0, handIdx + 1).map(h => h.outcome);
  const currentHand = session.hands[handIdx];
  const isFirst = handIdx === 0;
  const isLast  = handIdx === session.hands.length - 1;

  // Mock signal states per hand (in real version these are computed from profile)
  const mockSignalForHand = (idx: number) => {
    if (idx < 9) return { playability: "grey" as const, label: "Insufficient data" };
    if (idx < 18) return { playability: "amber" as const, label: "Pattern forming" };
    return { playability: "green" as const, label: "Window open" };
  };

  const sig = mockSignalForHand(handIdx);

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-12">
        <div>
          <div className="page-title">Shoe Replay</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {session.venue} · {session.tableNumber} · {session.date}
          </div>
        </div>
        <button className="btn btn-ghost" onClick={() => setSession(null)}>← Back</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
        {/* Left controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Hand scrubber */}
          <div className="panel">
            <div className="panel-title">Hand Position</div>
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <div className="hand-number">{handIdx + 1}</div>
              <div className="hand-label">of {session.hands.length} hands</div>
            </div>

            <input
              type="range"
              min={0}
              max={session.hands.length - 1}
              value={handIdx}
              onChange={e => setHandIdx(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--gold)", marginBottom: 12 }}
            />

            <div className="flex gap-8">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setHandIdx(0)}>
                ⏮
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }} disabled={isFirst} onClick={() => setHandIdx(i => i - 1)}>
                ◀
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }} disabled={isLast} onClick={() => setHandIdx(i => i + 1)}>
                ▶
              </button>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setHandIdx(session.hands.length - 1)}>
                ⏭
              </button>
            </div>
          </div>

          {/* Current hand result */}
          <div className="panel">
            <div className="panel-title">Hand {handIdx + 1} Result</div>
            <div style={{
              textAlign: "center",
              padding: "16px 0",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-dark)",
            }}>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                color: currentHand.outcome === "banker" ? "var(--banker-red)"
                     : currentHand.outcome === "player" ? "var(--player-blue)"
                     : "var(--tie-green)",
              }}>
                {currentHand.outcome.toUpperCase()}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                {currentHand.natural ? "Natural" : ""}
                {currentHand.bankerPair ? " · Banker Pair" : ""}
                {currentHand.playerPair ? " · Player Pair" : ""}
                {!currentHand.natural && !currentHand.bankerPair && !currentHand.playerPair ? "Standard hand" : ""}
              </div>
            </div>
          </div>

          {/* Signal at this point */}
          <div className="panel">
            <div className="panel-title">Signal at Hand {handIdx + 1}</div>
            <div className={`signal-band ${sig.playability}`} style={{ marginBottom: 10 }}>
              <div className={`signal-dot ${sig.playability}`} />
              <span style={{ fontWeight: 700 }}>{sig.label}</span>
            </div>
            <div className="entity-strip">
              {[
                { name: "You",     call: handIdx >= 9 ? { side: "banker" as const, conf: 78 } : null },
                { name: "Sniper",  call: handIdx >= 9 ? { side: "banker" as const, conf: 71 } : null },
                { name: "Grinder", call: handIdx >= 9 ? { side: "player" as const, conf: 58 } : null },
              ].map(({ name, call }) => (
                <div key={name} className="entity-card">
                  <div className="entity-name">{name}</div>
                  {call ? (
                    <>
                      <div className={`entity-call ${call.side}`}>
                        {call.side === "banker" ? "B" : "P"}
                      </div>
                      <div className="entity-conf">{call.conf}%</div>
                    </>
                  ) : (
                    <div className="entity-call none">–</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sequence up to now */}
          <div className="panel">
            <div className="panel-title">Sequence so far</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, maxHeight: 120, overflowY: "auto" }}>
              {session.hands.slice(0, handIdx + 1).map((h, i) => (
                <span
                  key={i}
                  className={`badge ${h.outcome === "banker" ? "badge-banker" : h.outcome === "player" ? "badge-player" : "badge-tie"}`}
                  style={{ fontSize: 10, opacity: i === handIdx ? 1 : 0.6 }}
                >
                  {h.outcome === "banker" ? "B" : h.outcome === "player" ? "P" : "T"}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: roads */}
        <div>
          <RoadsDisplay outcomes={visibleOutcomes} />
        </div>
      </div>
    </div>
  );
}
