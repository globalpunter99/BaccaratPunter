import { useState } from "react";
import { mockSessions } from "../../mock/data";
import type { Session } from "../../mock/data";
import type { Outcome } from "../../game/baccarat";
import RoadsDisplay from "../roads/RoadsDisplay";
import {
  settle, totalStake,
  type BetSlip, type SideBetType, type Settlement,
} from "../../game/payouts";
import { loadPayoutSettings, tableForCasino } from "../../lib/payoutSettings";

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

  // ── My Bets (same engine as Live Session, practice money) ──
  const [sideBetMode, setSideBetMode] = useState(false);
  const [pendingMain, setPendingMain] = useState<"banker" | "player" | null>(null);
  const [pendingStake, setPendingStake] = useState(0);
  const [pendingSides, setPendingSides] = useState<Partial<Record<SideBetType, number>>>({});
  const [lastSlip, setLastSlip] = useState<BetSlip | null>(null);
  const [lastSettlement, setLastSettlement] = useState<Settlement | null>(null);
  const [settledGame, setSettledGame] = useState<number | null>(null);
  const [ledger, setLedger] = useState({ staked: 0, returned: 0 });
  const STAKE_PRESETS = [5, 25, 50, 100, 500, 1000];

  const pendingSlip: BetSlip = {
    main: pendingMain && pendingStake > 0 ? { side: pendingMain, stake: pendingStake } : undefined,
    side: pendingSides,
  };
  const hasPendingBet = totalStake(pendingSlip) > 0;

  function clearPendingBet() {
    setPendingMain(null);
    setPendingStake(0);
    setPendingSides({});
  }

  function repeatLastBet() {
    if (!lastSlip) return;
    setPendingMain(lastSlip.main?.side === "tie" ? null : lastSlip.main?.side ?? null);
    setPendingStake(lastSlip.main?.stake ?? 0);
    setPendingSides({ ...lastSlip.side });
  }

  // Place the bet: settles against the hidden result and reveals it
  function placeBet() {
    if (!session || !hasPendingBet) return;
    const h = session.hands[handIdx];
    const table = tableForCasino(loadPayoutSettings(), session.venue);
    const result = settle(pendingSlip, {
      outcome: h.outcome,
      natural: h.natural,
      bankerPair: h.bankerPair,
      playerPair: h.playerPair,
    }, true, table);
    setLedger(l => ({ staked: l.staked + result.staked, returned: l.returned + result.returned }));
    setLastSettlement(result);
    setSettledGame(handIdx);
    setLastSlip(pendingSlip);
    playCall(pendingMain);
    clearPendingBet();
  }

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
  // Revealed games drive the roads; each carries the hand's markers plus
  // the user's bet result (win = light tile, loss = dark tile; ties and
  // skips leave no wash), matching the Live Session behaviour.
  const visible = session.hands
    .map((h, i) => ({ h, g: guesses[i] }))
    .filter(x => x.g.revealed);
  const visibleOutcomes: Outcome[] = visible.map(x => x.h.outcome);
  const visibleExtras = visible.map(({ h, g }) => {
    let betResult: "win" | "loss" | undefined;
    if (g.guess && g.guess !== "tie" && h.outcome !== "tie") {
      betResult = g.guess === h.outcome ? "win" : "loss";
    }
    return {
      natural: h.natural,
      bankerPair: h.bankerPair,
      playerPair: h.playerPair,
      betResult,
    };
  });
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

          {/* Calls summary */}
          <div className="panel" style={{ padding: "10px 14px" }}>
            <div className="flex items-center" style={{ gap: 10 }}>
              <div className="panel-title" style={{ marginBottom: 0 }}>My Calls</div>
              <div style={{ flex: 1, textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>
                P/(L):{" "}
                <b className={`ledger-pl ${ledger.returned - ledger.staked >= 0 ? "up" : "down"}`} style={{ fontSize: 13 }}>
                  {ledger.returned - ledger.staked > 0
                    ? `+${ledger.returned - ledger.staked}`
                    : ledger.returned - ledger.staked < 0
                    ? `(${Math.abs(ledger.returned - ledger.staked)})`
                    : "0"}
                </b>
                {" · "}
                <b style={{ color: "var(--text-primary)" }}>{betHands.length}</b> Bets:{" "}
                <b style={{ color: "var(--tie-green)" }}>{winCount}</b> (W){" "}
                <b style={{ color: "var(--banker-red)" }}>{loseCount}</b> (L){" "}
                <b style={{ color: "var(--text-secondary)" }}>{tieCount}</b> (Tie)
              </div>
            </div>
          </div>

          {/* Game panel — call buttons, then the result card after reveal */}
          <div className="panel">
            <div className="panel-title">{revealed ? `Game ${handIdx + 1} Result` : `My Bets — Game ${handIdx + 1}`}</div>
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
                {lastSettlement && settledGame === handIdx && (
                  <div
                    className="settlement-flash"
                    style={{
                      borderColor: lastSettlement.profit >= 0 ? "var(--tie-green)" : "var(--banker-red)",
                      padding: "5px 10px", fontSize: 12,
                    }}
                  >
                    Last bet:{" "}
                    <b style={{ color: lastSettlement.profit >= 0 ? "var(--tie-green)" : "var(--banker-red)" }}>
                      {lastSettlement.profit >= 0
                        ? `Bet Win ${lastSettlement.profit}`
                        : `Bet Lose −${Math.abs(lastSettlement.profit)}`}
                    </b>
                  </div>
                )}
                <button className="btn btn-gold" onClick={nextHand}>
                  {handIdx + 1 >= session.hands.length ? "Finish" : "Next Game →"}
                </button>
              </div>
            ) : (
              <div>
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

                {/* Casino chips — each press adds to the amount */}
                <div className="chip-row" style={{ justifyContent: "center" }}>
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

                {/* Play actions */}
                <button
                  className="btn btn-gold"
                  style={{ width: "100%", marginBottom: 6 }}
                  disabled={!hasPendingBet}
                  onClick={placeBet}
                >
                  Place Bet — Reveal Result
                </button>
                <button className="btn skip-btn" style={{ width: "100%", padding: "9px 0", marginBottom: 8 }} onClick={() => { clearPendingBet(); playCall(null); }}>
                  Skip (no bet)
                </button>

                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11 }} disabled={!lastSlip} onClick={repeatLastBet}>
                    ↻ Re-bet
                  </button>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11 }} disabled={!hasPendingBet} onClick={clearPendingBet}>
                    ✕ Clear bet
                  </button>
                </div>

                {/* Side bets */}
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
          <RoadsDisplay outcomes={visibleOutcomes} extras={visibleExtras} />
        </div>
      </div>
    </div>
  );
}
