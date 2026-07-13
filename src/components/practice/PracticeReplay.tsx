import { useState } from "react";
import { mockSessions } from "../../mock/data";
import type { Session } from "../../mock/data";
import type { Outcome } from "../../game/baccarat";
import RoadsDisplay from "../roads/RoadsDisplay";

// Practice Play: walk a real library session with the results hidden,
// call each hand, then reveal. (The separate Replay mode was removed —
// practice covers the walk-through need.)

type Phase = "pick" | "active" | "done";

interface Guess {
  guess: Outcome | null;
  actual: Outcome;
  revealed: boolean;
}

export default function PracticeReplay() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [session, setSession] = useState<Session | null>(null);
  const [handIdx, setHandIdx] = useState(0);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [pendingGuess, setPendingGuess] = useState<Outcome | null>(null);
  const [revealed, setRevealed] = useState(false);

  function start(s: Session) {
    setSession(s);
    setHandIdx(0);
    setGuesses(s.hands.map(h => ({ guess: null, actual: h.outcome, revealed: false })));
    setPendingGuess(null);
    setRevealed(false);
    setPhase("active");
  }

  const revealedHands = guesses.filter(g => g.revealed);
  const betHands = revealedHands.filter(g => g.guess !== null);
  const winCount  = betHands.filter(g => g.guess === g.actual).length;
  const tieCount  = betHands.filter(g => g.actual === "tie" && g.guess !== "tie").length;
  const loseCount = betHands.length - winCount - tieCount;

  // One tap plays the game: Skip (null), Banker or Player. The result
  // reveals immediately.
  function playCall(call: Outcome | null) {
    setPendingGuess(call);
    setGuesses(prev => {
      const next = [...prev];
      next[handIdx] = { ...next[handIdx], guess: call, revealed: true };
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

  // On-demand position jump. Moving forward auto-reveals every game passed
  // over (recorded as no-bet skips) so the roads stay a contiguous sequence;
  // moving back just reviews already-revealed games.
  function goToGame(target: number) {
    if (!session) return;
    const idx = Math.max(0, Math.min(target, session.hands.length - 1));
    if (idx > handIdx) {
      setGuesses(prev => {
        const next = [...prev];
        for (let i = handIdx; i < idx; i++) {
          if (!next[i].revealed) next[i] = { ...next[i], revealed: true };
        }
        return next;
      });
    }
    setHandIdx(idx);
    setPendingGuess(null);
    setRevealed(guesses[idx]?.revealed ?? false);
  }

  // ── Pick phase ──
  if (phase === "pick" || !session) {
    return (
      <div className="page" style={{ maxWidth: 700 }}>
        <div className="page-title">Practice Play</div>
        <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
          Select a session from your library. The results will be hidden — play through it game
          by game as if you're at the table. After placing your call, reveal the actual result.
          Because these are real recorded shoes, you'll never quite remember every hand.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {mockSessions.map(s => (
            <div
              key={s.id}
              className="panel"
              style={{ cursor: "pointer" }}
              onClick={() => start(s)}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-accent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-panel)")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontWeight: 600 }}>{s.venue}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {s.tableNumber} · {s.date} · {s.hands.length} games
                  </div>
                </div>
                <button className="btn btn-gold" style={{ fontSize: 12, padding: "6px 14px" }}>
                  🎯 Practice
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Done phase ──
  if (phase === "done") {
    // Win rate on decided bets (ties push, so they're excluded)
    const decided = winCount + loseCount;
    const pct = decided > 0 ? Math.round((winCount / decided) * 100) : 0;
    return (
      <div className="page" style={{ maxWidth: 500 }}>
        <div className="page-title">Practice Complete</div>
        <div className="panel" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎴</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>
            {pct}% Win Rate
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
            {betHands.length} Bets: {winCount} (W) · {loseCount} (L) · {tieCount} (Tie)
          </div>
          <div className="grid-3" style={{ marginBottom: 24 }}>
            <div className="stat-block">
              <div className="stat-value">{guesses.length}</div>
              <div className="stat-label">Total Games</div>
            </div>
            <div className="stat-block">
              <div className="stat-value text-green">{winCount}</div>
              <div className="stat-label">Wins</div>
            </div>
            <div className="stat-block">
              <div className="stat-value text-red">{loseCount}</div>
              <div className="stat-label">Losses</div>
            </div>
          </div>
          <div className="flex gap-8" style={{ justifyContent: "center" }}>
            <button className="btn btn-gold" onClick={() => setPhase("pick")}>Pick Another</button>
            <button className="btn btn-secondary" onClick={() => start(session)}>Practice Again</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active phase ──
  const visibleOutcomes: Outcome[] = guesses.filter(g => g.revealed).map(g => g.actual);
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
          <div className="page-title">Practice Play</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {session.venue} · {session.tableNumber} · Game {handIdx + 1} of {session.hands.length}
          </div>
        </div>
        <div className="flex gap-8 items-center">
          <button className="btn btn-ghost" onClick={() => setPhase("pick")}>← End</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        {/* Left controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Game position — compact, usable on demand. Moving forward
              auto-reveals the games passed over (no-bet skips). */}
          <div className="panel" style={{ padding: "10px 14px" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <div className="panel-title" style={{ marginBottom: 0 }}>Game Position</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                <b style={{ fontSize: 16, color: "var(--gold)" }}>{handIdx + 1}</b>
                {" "}of {session.hands.length} Games
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={session.hands.length - 1}
              value={handIdx}
              onChange={e => goToGame(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--gold)", marginBottom: 8 }}
            />
            <div className="flex gap-8">
              <button className="btn btn-ghost" style={{ flex: 1, padding: "4px 0" }} onClick={() => goToGame(0)}>⏮</button>
              <button className="btn btn-ghost" style={{ flex: 1, padding: "4px 0" }} disabled={handIdx === 0} onClick={() => goToGame(handIdx - 1)}>◀</button>
              <button className="btn btn-ghost" style={{ flex: 1, padding: "4px 0" }} disabled={handIdx === session.hands.length - 1} onClick={() => goToGame(handIdx + 1)}>▶</button>
              <button className="btn btn-ghost" style={{ flex: 1, padding: "4px 0" }} onClick={() => goToGame(session.hands.length - 1)}>⏭</button>
            </div>
          </div>

          {/* Game panel — call buttons, then the result card after reveal */}
          <div className="panel">
            <div className="panel-title">Game {handIdx + 1}{revealed ? " Result" : ""}</div>
            {revealed ? (
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
                  {pendingGuess && (
                    <div style={{
                      marginTop: 10, fontSize: 14, fontWeight: 700,
                      color: isCorrect ? "var(--signal-green)" : isWrong ? "var(--banker-red)" : "var(--tie-green)",
                    }}>
                      {isCorrect ? "✓ WIN" : actual === "tie" ? "TIE — bet pushes" : "✗ LOSE"}
                    </div>
                  )}
                </div>
                <button className="btn btn-gold" onClick={nextHand}>
                  {handIdx + 1 >= session.hands.length ? "Finish" : "Next Game →"}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Study the roads, then play the game:
                </div>
                <button className="btn skip-btn" onClick={() => playCall(null)}>
                  Skip (no bet)
                </button>
                <button className="btn btn-banker" onClick={() => playCall("banker")}>
                  庄 BANKER
                </button>
                <button className="btn btn-player" onClick={() => playCall("player")}>
                  闲 PLAYER
                </button>
              </div>
            )}
          </div>

          {/* Calls summary */}
          <div className="panel" style={{ padding: "10px 14px" }}>
            <div className="flex items-center justify-between">
              <div className="panel-title" style={{ marginBottom: 0 }}>My Calls</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                <b style={{ color: "var(--text-primary)" }}>{betHands.length}</b> Bets:{" "}
                <b style={{ color: "var(--tie-green)" }}>{winCount}</b> (W){" "}
                <b style={{ color: "var(--banker-red)" }}>{loseCount}</b> (L){" "}
                <b style={{ color: "var(--text-secondary)" }}>{tieCount}</b> (Tie)
              </div>
            </div>
          </div>

          {/* Signal at this point */}
          <div className="panel">
            <div className="panel-title">Signal at Game {handIdx + 1}</div>
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

        {/* Right: roads (revealed so far) */}
        <div>
          <RoadsDisplay outcomes={visibleOutcomes} betsToggle={false} />
        </div>
      </div>
    </div>
  );
}
