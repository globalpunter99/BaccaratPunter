import { useState } from "react";
import type { Session } from "../../mock/data";
import type { Outcome } from "../../game/baccarat";
import RoadsDisplay from "../roads/RoadsDisplay";
import {
  settle, totalStake,
  type BetSlip, type SideBetType, type Settlement,
} from "../../game/payouts";
import {
  ChipRow, ChipTargetHint, SideBetGrid, StakeField, type ChipTarget,
} from "../session/BetSlipControls";
import { loadPayoutSettings, tableForCasino } from "../../lib/payoutSettings";
import { nextSignal } from "../../game/signals";
import { GRINDER_CONFIG, SNIPER_CONFIG } from "../../game/profile";
import { loadYouConfig } from "../../lib/profileStore";

// Practice mode: play a library shoe with the results hidden — call or bet
// each hand, then reveal. Launched from a session card in the Library (the
// standalone Practice tab and its picker were retired). A finished or
// in-progress practice run can be saved back to the Library as a new session.

type Phase = "active" | "done";

interface Guess {
  guess: Outcome | null;
  actual: Outcome;
  revealed: boolean;
}

export default function PracticePlayer({ session, onBack, onSave }: {
  session: Session;
  onBack: () => void;
  onSave: (draft: Session) => void;
}) {
  const [phase, setPhase] = useState<Phase>("active");
  const [handIdx, setHandIdx] = useState(0);
  const [guesses, setGuesses] = useState<Guess[]>(
    () => session.hands.map(h => ({ guess: null, actual: h.outcome, revealed: false })),
  );
  const [pendingGuess, setPendingGuess] = useState<Outcome | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  // ── My Bets (same engine as Live Session, practice money) ──
  // "bets" = full staking mode · "calls" = zero-bet mode, one-tap
  // Skip/Banker/Player with no amounts
  const [betMode, setBetMode] = useState<"bets" | "calls">("bets");
  const [sideBetMode, setSideBetMode] = useState(false);
  const [pendingMain, setPendingMain] = useState<"banker" | "player" | null>(null);
  const [pendingStake, setPendingStake] = useState(0);
  const [pendingSides, setPendingSides] = useState<Partial<Record<SideBetType, number>>>({});
  const [lastSlip, setLastSlip] = useState<BetSlip | null>(null);
  const [lastSettlement, setLastSettlement] = useState<Settlement | null>(null);
  const [settledGame, setSettledGame] = useState<number | null>(null);
  const [ledger, setLedger] = useState({ staked: 0, returned: 0 });
  // Which stake field the chips feed — see BetSlipControls.
  const [chipTarget, setChipTarget] = useState<ChipTarget>("main");

  const pendingSlip: BetSlip = {
    main: pendingMain && pendingStake > 0 ? { side: pendingMain, stake: pendingStake } : undefined,
    side: pendingSides,
  };
  const hasPendingBet = totalStake(pendingSlip) > 0;

  function addChip(value: number) {
    if (chipTarget === "main") {
      setPendingStake(s => s + value);
      return;
    }
    setPendingSides(p => ({ ...p, [chipTarget]: (p[chipTarget] ?? 0) + value }));
  }

  /** Collapsing the side bets hands the chips back to the main bet. */
  function toggleSideBets() {
    setSideBetMode(open => {
      if (open) setChipTarget("main");
      return !open;
    });
  }

  /** Full reset — used when a hand is played or skipped, not by Clear Bet. */
  function clearPendingBet() {
    setPendingMain(null);
    setPendingStake(0);
    setPendingSides({});
    setChipTarget("main");
  }

  /** What the highlighted field currently holds. */
  const activeAmount = chipTarget === "main"
    ? pendingStake
    : (pendingSides[chipTarget] ?? 0);

  /** Clear Bet empties ONLY the gold-highlighted field — see LiveSession. */
  function clearActiveBet() {
    if (chipTarget === "main") {
      setPendingStake(0);
      return;
    }
    setPendingSides(p => {
      const next = { ...p };
      delete next[chipTarget];
      return next;
    });
  }

  function repeatLastBet() {
    if (!lastSlip) return;
    setPendingMain(lastSlip.main?.side === "tie" ? null : lastSlip.main?.side ?? null);
    setPendingStake(lastSlip.main?.stake ?? 0);
    setPendingSides({ ...lastSlip.side });
    setChipTarget("main");
  }

  // Place the bet: settles against the hidden result and reveals it
  function placeBet() {
    if (!hasPendingBet) return;
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

  function restart() {
    setHandIdx(0);
    setGuesses(session.hands.map(h => ({ guess: null, actual: h.outcome, revealed: false })));
    setPendingGuess(null);
    setRevealed(false);
    setLedger({ staked: 0, returned: 0 });
    setLastSlip(null);
    setLastSettlement(null);
    setSettledGame(null);
    clearPendingBet();
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
    if (handIdx + 1 >= session.hands.length) {
      setPhase("done");
      return;
    }
    setHandIdx(i => i + 1);
    setPendingGuess(null);
    setRevealed(false);
  }

  // Build the draft session a save would create: a copy of the shoe, tagged
  // as a practice save of the original, with this run's result in the notes.
  function buildDraft(): Session {
    const decided = winCount + loseCount;
    const pct = decided > 0 ? Math.round((winCount / decided) * 100) : 0;
    const today = new Date().toISOString().slice(0, 10);
    const result = betHands.length > 0
      ? ` Result ${winCount}W / ${loseCount}L / ${tieCount}T${decided ? ` (${pct}%)` : ""}.`
      : " No calls placed.";
    return {
      id: session.id, // store reassigns to `<id>-P<n>`
      date: today,
      venue: session.venue,
      tableNumber: session.tableNumber,
      type: session.type,
      hands: session.hands.map(h => ({ ...h })),
      practiceOf: session.id,
      savedAt: today,
      notes: `Saved practice session of ${session.venue}.${result}`,
    };
  }

  const saveModal = saveOpen ? (
    <div className="info-overlay" onClick={() => setSaveOpen(false)}>
      <div className="info-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Save this practice session?</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
          It will be saved as a <b style={{ color: "var(--text-primary)" }}>new, separate session</b> in
          your library — its id echoes the original ({session.id}) so the two sit together for
          comparison, and it stays linked to the original shoe. Your result so far
          ({winCount}W / {loseCount}L / {tieCount}T) is recorded in its notes.
        </div>
        <div className="flex gap-8" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={() => setSaveOpen(false)}>Cancel</button>
          <button className="btn btn-gold" onClick={() => { onSave(buildDraft()); setSaveOpen(false); }}>
            Save to Library
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // On-demand position jump. Moving forward auto-reveals every game passed
  // over (recorded as no-bet skips) so the roads stay a contiguous sequence;
  // moving back just reviews already-revealed games.
  function goToGame(target: number) {
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
          <div className="flex gap-8" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-gold" onClick={() => setSaveOpen(true)}>💾 Save Session</button>
            <button className="btn btn-secondary" onClick={restart}>Practice Again</button>
            <button className="btn btn-ghost" onClick={onBack}>← Back to Library</button>
          </div>
        </div>
        {saveModal}
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

  // Live engine reads for the upcoming hand, from the revealed history only.
  // No coloured band here — the SIT/call cards below already carry the state.
  const pracSignals = {
    you: nextSignal(visibleOutcomes, loadYouConfig()),
    sniper: nextSignal(visibleOutcomes, SNIPER_CONFIG),
    grinder: nextSignal(visibleOutcomes, GRINDER_CONFIG),
  };

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-12">
        <div>
          <div className="page-title">Practice — {session.venue}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            {session.tableNumber} · Game {handIdx + 1} of {session.hands.length} · results hidden until you call
          </div>
        </div>
        <div className="flex gap-8 items-center">
          <button className="btn btn-gold" style={{ fontSize: 12, padding: "6px 14px" }} onClick={() => setSaveOpen(true)}>
            💾 Save Session
          </button>
          <button className="btn btn-ghost" onClick={onBack}>← Back to Library</button>
        </div>
      </div>
      {saveModal}

      <div className="grid-300-fluid">
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
                {/* Mode: full bets vs zero-bet calls */}
                <div className="mode-tabs" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <button
                    className={`mode-tab ${betMode === "bets" ? "active" : ""}`}
                    onClick={() => setBetMode("bets")}
                  >
                    BETS
                  </button>
                  <button
                    className={`mode-tab ${betMode === "calls" ? "active" : ""}`}
                    onClick={() => setBetMode("calls")}
                  >
                    CALLS ONLY
                  </button>
                </div>

                {betMode === "calls" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 2 }}>
                      No money down — just call the game:
                    </div>
                    <button className="btn skip-btn" onClick={() => { clearPendingBet(); playCall(null); }}>
                      Skip (no bet)
                    </button>
                    <button className="btn btn-banker" onClick={() => { clearPendingBet(); playCall("banker"); }}>
                      庄 BANKER
                    </button>
                    <button className="btn btn-player" onClick={() => { clearPendingBet(); playCall("player"); }}>
                      闲 PLAYER
                    </button>
                  </div>
                ) : (
                <>
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
                  <StakeField
                    amount={pendingStake}
                    active={chipTarget === "main"}
                    emptyLabel="Amount $"
                    title="Tap, then tap chips to stake the main bet"
                    onSelect={() => setChipTarget("main")}
                  />
                </div>

                {/* Casino chips — each press adds to whichever field is active */}
                <ChipRow onAdd={addChip} centred />
                {sideBetMode && <ChipTargetHint target={chipTarget} />}

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
                  <button className="btn btn-ghost btn-slip-action" style={{ flex: 1, fontSize: 11 }} disabled={!lastSlip} onClick={repeatLastBet}>
                    ↻ Re-bet
                  </button>
                  <button className="btn btn-ghost btn-slip-action" style={{ flex: 1, fontSize: 11 }} disabled={activeAmount <= 0} onClick={clearActiveBet}>
                    ✕ Clear Bet
                  </button>
                </div>

                {/* Side bets */}
                <button
                  className="btn btn-ghost"
                  style={{ width: "100%", fontSize: 11, marginTop: 8, marginBottom: sideBetMode ? 8 : 0 }}
                  onClick={toggleSideBets}
                >
                  {sideBetMode ? "▲ Hide side bets" : "▼ Side bets"}
                </button>
                {sideBetMode && (
                  <SideBetGrid
                    values={pendingSides}
                    target={chipTarget}
                    onSelect={setChipTarget}
                  />
                )}
                </>
                )}
              </div>
            )}
          </div>

          {/* Signal at this point */}
          <div className="panel">
            <div className="panel-title">Signal at Game {handIdx + 1}</div>
            <div className="entity-strip">
              {([
                ["You", pracSignals.you],
                ["Sniper", pracSignals.sniper],
                ["Grinder", pracSignals.grinder],
              ] as const).map(([name, s]) => (
                <div key={name} className="entity-card">
                  <div className="entity-name">{name}</div>
                  {s === null ? (
                    <div className="entity-call none">–</div>
                  ) : s.window ? (
                    <>
                      <div className={`entity-call ${s.predictedSide}`}>
                        {s.predictedSide === "banker" ? "B" : "P"}
                      </div>
                      <div className="entity-conf">{s.confidence}%</div>
                    </>
                  ) : (
                    <>
                      <div className="entity-call none" style={{ fontSize: 15 }}>SIT</div>
                      <div className="entity-conf" style={{ color: "var(--text-muted)" }}>{s.alignment}/3</div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: roads (revealed so far) */}
        <div>
          <RoadsDisplay outcomes={visibleOutcomes} extras={visibleExtras} betsToggleLabel="Bets/Calls" />
        </div>
      </div>
    </div>
  );
}
