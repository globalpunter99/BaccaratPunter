import { useState } from "react";
import { mockSessions } from "../../mock/data";
import type { Session } from "../../mock/data";
import type { Outcome } from "../../game/baccarat";
import RoadsDisplay from "../roads/RoadsDisplay";

// Practice Play and Shoe Replay merged: both walk a library session hand
// by hand. Replay reveals freely (scrub anywhere); Practice hides the
// future and scores your calls before each reveal.

type Phase = "pick" | "active" | "done";
type Mode = "practice" | "replay";

interface Guess {
  guess: Outcome | null;
  actual: Outcome;
  revealed: boolean;
}

export default function PracticeReplay() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [mode, setMode] = useState<Mode>("replay");
  const [session, setSession] = useState<Session | null>(null);
  const [handIdx, setHandIdx] = useState(0);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [pendingGuess, setPendingGuess] = useState<Outcome | null>(null);
  const [revealed, setRevealed] = useState(false);

  function start(s: Session, m: Mode) {
    setSession(s);
    setMode(m);
    setHandIdx(0);
    setGuesses(s.hands.map(h => ({ guess: null, actual: h.outcome, revealed: false })));
    setPendingGuess(null);
    setRevealed(false);
    setPhase("active");
  }

  // ── Practice scoring ──
  const revealedHands = guesses.filter(g => g.revealed);
  const hitCount = revealedHands.filter(g => g.guess !== null && g.guess !== "tie" && g.guess === g.actual).length;
  const calledCount = revealedHands.filter(g => g.guess !== null && g.guess !== "tie").length;

  function revealResult() {
    if (!pendingGuess && !revealed) return;
    setGuesses(prev => {
      const next = [...prev];
      next[handIdx] = { ...next[handIdx], guess: pendingGuess, revealed: true };
      return next;
    });
    setRevealed(true);
  }

  function nextHand() {
    if (!session) return;
    if (handIdx + 1 >= session.hands.length) {
      setPhase("done");
      return;
    }
    setHandIdx(i => i + 1);
    setPendingGuess(null);
    setRevealed(false);
  }

  function skipHand() {
    setGuesses(prev => {
      const next = [...prev];
      next[handIdx] = { ...next[handIdx], guess: null, revealed: true };
      return next;
    });
    nextHand();
  }

  // Practice → Replay: reveal everything, keep position
  function switchToReplay() {
    setMode("replay");
    setRevealed(false);
    setPendingGuess(null);
  }

  // ── Pick phase ──
  if (phase === "pick" || !session) {
    return (
      <div className="page" style={{ maxWidth: 700 }}>
        <div className="page-title">Practice / Replay</div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
          Pick a session from your library.{" "}
          <b style={{ color: "var(--text-primary)" }}>Replay</b> steps through the shoe with
          everything visible — review how the roads built and what signals were present.{" "}
          <b style={{ color: "var(--text-primary)" }}>Practice</b> hides the results — call
          each hand as if you're at the table, then reveal. Real shoes, so it always feels fresh.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mockSessions.map(s => (
            <div key={s.id} className="panel">
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontWeight: 600 }}>{s.venue}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {s.tableNumber} · {s.date} · {s.hands.length} hands
                  </div>
                </div>
                <div className="flex gap-8">
                  <button className="btn btn-gold" style={{ fontSize: 12, padding: "6px 14px" }}
                    onClick={() => start(s, "practice")}>
                    🎯 Practice
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 14px" }}
                    onClick={() => start(s, "replay")}>
                    Replay ▶
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Done phase (practice complete) ──
  if (phase === "done") {
    const pct = calledCount > 0 ? Math.round((hitCount / calledCount) * 100) : 0;
    return (
      <div className="page" style={{ maxWidth: 500 }}>
        <div className="page-title">Practice Complete</div>
        <div className="panel" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎴</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>
            {pct}% Hit Rate
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
            You called {hitCount} correct out of {calledCount} called hands
          </div>
          <div className="grid-3" style={{ marginBottom: 24 }}>
            <div className="stat-block">
              <div className="stat-value">{guesses.length}</div>
              <div className="stat-label">Total Hands</div>
            </div>
            <div className="stat-block">
              <div className="stat-value">{calledCount}</div>
              <div className="stat-label">Hands Called</div>
            </div>
            <div className="stat-block">
              <div className="stat-value text-green">{hitCount}</div>
              <div className="stat-label">Correct</div>
            </div>
          </div>
          <div className="flex gap-8" style={{ justifyContent: "center" }}>
            <button className="btn btn-gold" onClick={() => setPhase("pick")}>Pick Another</button>
            <button className="btn btn-secondary" onClick={() => start(session, "practice")}>Practice Again</button>
            <button className="btn btn-secondary" onClick={() => start(session, "replay")}>Replay Shoe</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active phase ──
  const isReplay = mode === "replay";
  const visibleOutcomes: Outcome[] = isReplay
    ? session.hands.slice(0, handIdx + 1).map(h => h.outcome)
    : guesses.filter(g => g.revealed).map(g => g.actual);
  const currentHand = session.hands[handIdx];
  const actual = currentHand.outcome;
  const isCorrect = revealed && pendingGuess !== null && pendingGuess !== "tie" && pendingGuess === actual;
  const isWrong   = revealed && pendingGuess !== null && pendingGuess !== "tie" && pendingGuess !== actual;

  // Mock signal states per hand (real version computes these from the profile)
  const sig = handIdx < 9
    ? { playability: "grey" as const, label: "Insufficient data" }
    : handIdx < 18
    ? { playability: "amber" as const, label: "Pattern forming" }
    : { playability: "green" as const, label: "Window open" };

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-12">
        <div>
          <div className="page-title">{isReplay ? "Shoe Replay" : "Practice Play"}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {session.venue} · {session.tableNumber} · Hand {handIdx + 1} of {session.hands.length}
          </div>
        </div>
        <div className="flex gap-8 items-center">
          {!isReplay && (
            <>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {hitCount}/{calledCount} calls correct
              </span>
              <button className="btn btn-ghost" onClick={switchToReplay} title="Reveal everything and scrub freely">
                Switch to Replay
              </button>
            </>
          )}
          <button className="btn btn-ghost" onClick={() => setPhase("pick")}>← End</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        {/* Left controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Hand position — same panel in both modes; scrubbing unlocks in Replay */}
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
              disabled={!isReplay}
              onChange={e => setHandIdx(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--gold)", marginBottom: 12, opacity: isReplay ? 1 : 0.4 }}
            />
            <div className="flex gap-8">
              <button className="btn btn-ghost" style={{ flex: 1 }} disabled={!isReplay} onClick={() => setHandIdx(0)}>⏮</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} disabled={!isReplay || handIdx === 0} onClick={() => setHandIdx(i => i - 1)}>◀</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} disabled={!isReplay || handIdx === session.hands.length - 1} onClick={() => setHandIdx(i => i + 1)}>▶</button>
              <button className="btn btn-ghost" style={{ flex: 1 }} disabled={!isReplay} onClick={() => setHandIdx(session.hands.length - 1)}>⏭</button>
            </div>
            {!isReplay && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
                Free scrubbing unlocks in Replay mode
              </div>
            )}
          </div>

          {/* Hand panel — result card in replay / after reveal; call buttons in practice */}
          <div className="panel">
            <div className="panel-title">Hand {handIdx + 1}{isReplay || revealed ? " Result" : ""}</div>
            {isReplay || revealed ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{
                  padding: "16px 0",
                  borderRadius: "var(--radius-md)",
                  textAlign: "center",
                  background: isCorrect ? "rgba(0,200,83,0.1)" : isWrong ? "rgba(232,60,60,0.1)" : "var(--bg-dark)",
                  border: `1px solid ${isCorrect ? "var(--signal-green)" : isWrong ? "var(--banker-red)" : "var(--border-panel)"}`,
                }}>
                  <div style={{
                    fontSize: 28, fontWeight: 700,
                    color: actual === "banker" ? "var(--banker-red)" : actual === "player" ? "var(--player-blue)" : "var(--tie-green)",
                  }}>
                    {actual.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                    {currentHand.natural ? "Natural" : ""}
                    {currentHand.bankerPair ? " · Banker Pair" : ""}
                    {currentHand.playerPair ? " · Player Pair" : ""}
                    {!currentHand.natural && !currentHand.bankerPair && !currentHand.playerPair ? "Standard hand" : ""}
                  </div>
                  {!isReplay && pendingGuess && (
                    <div style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: isCorrect ? "var(--signal-green)" : "var(--banker-red)" }}>
                      {isCorrect ? "✓ Correct!" : isWrong ? "✗ Wrong" : "—"}
                    </div>
                  )}
                </div>
                {!isReplay && (
                  <button className="btn btn-gold" onClick={nextHand}>
                    {handIdx + 1 >= session.hands.length ? "Finish" : "Next Hand →"}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Study the roads, then place your call:
                </div>
                <button
                  className="btn btn-banker"
                  onClick={() => setPendingGuess("banker")}
                  style={{ opacity: pendingGuess === "banker" ? 1 : pendingGuess ? 0.5 : 1, outline: pendingGuess === "banker" ? "2px solid white" : "none" }}
                >
                  庄 BANKER
                </button>
                <button
                  className="btn btn-player"
                  onClick={() => setPendingGuess("player")}
                  style={{ opacity: pendingGuess === "player" ? 1 : pendingGuess ? 0.5 : 1, outline: pendingGuess === "player" ? "2px solid white" : "none" }}
                >
                  闲 PLAYER
                </button>
                <div className="divider" />
                <button className="btn btn-gold" onClick={revealResult} disabled={!pendingGuess}>
                  Reveal Result
                </button>
                <button className="btn btn-ghost" onClick={skipHand}>
                  Skip (no bet)
                </button>
              </div>
            )}
          </div>

          {/* Signal at this point — shown in both modes */}
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
        </div>

        {/* Right: roads */}
        <div>
          <RoadsDisplay outcomes={visibleOutcomes} betsToggle={false} />
        </div>
      </div>
    </div>
  );
}
