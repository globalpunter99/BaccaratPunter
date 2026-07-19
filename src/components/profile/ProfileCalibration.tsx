import { useState } from "react";
import RoadsDisplay from "../roads/RoadsDisplay";
import { FOUNDATION_BOARDS, type FoundationBoard } from "../../mock/foundationGames";
import {
  deriveTraits, leanLabel, loadCalibration, resetCalibration, saveCalibration,
  type CalAnswer, type CalGuess, type CalibrationState,
} from "../../lib/calibrationStore";

// Calibration by play: the player walks the foundation boards and calls the
// next hand at set checkpoints, reading the real road screens exactly as they
// would at the table. Only calls that match the actual result become style
// evidence; skips and misses are kept as discipline measures. Board characters
// are revealed only after a board is finished, so reads aren't primed.

/** Checkpoints ask for the NEXT hand; if it lands on a tie, slide forward. */
function effectivePosition(board: FoundationBoard, checkpoint: number): number {
  let p = checkpoint;
  while (p < board.outcomes.length && board.outcomes[p] === "tie") p++;
  return Math.min(p, board.outcomes.length - 1);
}

function answersFor(cal: CalibrationState, boardId: string): CalAnswer[] {
  return cal.answers.filter(a => a.boardId === boardId);
}

export default function ProfileCalibration() {
  const [cal, setCal] = useState<CalibrationState>(loadCalibration);
  const [reveal, setReveal] = useState<CalAnswer | null>(null);
  const [boardSummary, setBoardSummary] = useState<FoundationBoard | null>(null);

  const board = FOUNDATION_BOARDS.find(b => !cal.completed.includes(b.id)) ?? null;
  const done = !board;

  function persist(next: CalibrationState) {
    setCal(next);
    saveCalibration(next);
  }

  // ── All boards complete: calibration summary ──
  if (done || boardSummary) {
    const traits = deriveTraits(cal, FOUNDATION_BOARDS);
    if (boardSummary) {
      const pb = traits.perBoard.find(p => p.boardId === boardSummary.id);
      const isLast = cal.completed.length >= FOUNDATION_BOARDS.length;
      return (
        <div className="panel" style={{ maxWidth: 640 }}>
          <div className="panel-title">{boardSummary.title} — complete</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gold)", marginBottom: 6 }}>
            Board character: {boardSummary.character}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
            {boardSummary.hint}
          </div>
          {pb && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              Your reads here: <b style={{ color: "var(--tie-green)" }}>{pb.correct}</b> correct
              of <b>{pb.reads}</b> calls · <b>{pb.skips}</b> sat out.
              Only the correct calls feed your profile.
            </div>
          )}
          <button className="btn btn-gold" onClick={() => setBoardSummary(null)}>
            {isLast ? "See calibration summary →" : "Next board →"}
          </button>
        </div>
      );
    }
    return (
      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="panel-title">Calibration complete</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
          Your profile now carries the style evidence from{" "}
          <b style={{ color: "var(--gold)" }}>{traits.correct}</b> confirmed reads
          across {FOUNDATION_BOARDS.length} boards. Wrong guesses were discarded;
          your sit-outs were kept as a selectivity measure.
        </div>
        <div className="grid-3" style={{ marginBottom: 14 }}>
          <div className="stat-block">
            <div className="stat-value text-green">{traits.correct}</div>
            <div className="stat-label">Confirmed reads</div>
          </div>
          <div className="stat-block">
            <div className="stat-value">{traits.hitRate}%</div>
            <div className="stat-label">Hit rate ({traits.reads} calls)</div>
          </div>
          <div className="stat-block">
            <div className="stat-value text-gold">{traits.skips}</div>
            <div className="stat-label">Sat out</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
          Style read from your confirmed calls:{" "}
          <b style={{ color: "var(--gold)" }}>{leanLabel(traits)}</b>
          {" "}({traits.follows} followed the run · {traits.flips} called the flip).
          Open the <b>Review</b> phase to see these reads on the actual screens.
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => { resetCalibration(); setCal(loadCalibration()); }}
        >
          Redo calibration
        </button>
      </div>
    );
  }

  // ── Active board ──
  const boardAnswers = answersFor(cal, board.id);
  const cpIdx = boardAnswers.length; // checkpoints answered so far on this board
  const checkpoint = board.checkpoints[Math.min(cpIdx, board.checkpoints.length - 1)];
  const pos = effectivePosition(board, checkpoint);
  // During a reveal, keep showing the position just answered — including the
  // revealed hand itself, so the player watches the result land on the road.
  const displayPos = reveal ? reveal.position : pos;
  const shown = board.outcomes.slice(0, reveal ? reveal.position + 1 : pos);
  const readNum = Math.min(reveal ? cpIdx : cpIdx + 1, board.checkpoints.length);
  const boardNumber = FOUNDATION_BOARDS.indexOf(board) + 1;

  function answer(guess: CalGuess) {
    const actual = board!.outcomes[pos];
    const a: CalAnswer = {
      boardId: board!.id,
      position: pos,
      guess,
      actual,
      correct: guess === "skip" || actual === "tie" ? null : guess === actual,
    };
    persist({ ...cal, answers: [...cal.answers, a] });
    setReveal(a);
  }

  function next() {
    const answeredNow = answersFor(cal, board!.id).length;
    setReveal(null);
    if (answeredNow >= board!.checkpoints.length) {
      persist({ ...cal, completed: [...cal.completed, board!.id] });
      setBoardSummary(board);
    }
  }

  return (
    <div>
      <div style={{
        fontSize: 12, color: "var(--text-muted)", marginBottom: 10,
        padding: "6px 10px", border: "1px dashed var(--border-panel)", borderRadius: "var(--radius-sm)",
      }}>
        Placeholder boards — the real foundation set (recorded live games) loads with the backend pass.
      </div>

      <div className="grid-300-fluid">
        {/* Left: progress + the call */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="panel" style={{ padding: "10px 14px" }}>
            <div className="flex items-center justify-between">
              <div className="panel-title" style={{ marginBottom: 0 }}>Calibration</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Board <b style={{ color: "var(--gold)" }}>{boardNumber}</b> of {FOUNDATION_BOARDS.length}
                {" · "}Read <b style={{ color: "var(--gold)" }}>{readNum}</b> of {board.checkpoints.length}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">
              {reveal ? `Game ${displayPos + 1} result` : `Your call — game ${displayPos + 1}`}
            </div>
            {reveal ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{
                  padding: "16px 0", textAlign: "center", borderRadius: "var(--radius-md)",
                  background: reveal.correct === true ? "rgba(0,200,83,0.1)"
                    : reveal.correct === false ? "rgba(232,60,60,0.1)" : "var(--bg-dark)",
                  border: `1px solid ${reveal.correct === true ? "var(--signal-green)"
                    : reveal.correct === false ? "var(--banker-red)" : "var(--border-panel)"}`,
                }}>
                  <div style={{
                    fontSize: 26, fontWeight: 700,
                    color: reveal.actual === "banker" ? "var(--banker-red)"
                      : reveal.actual === "player" ? "var(--player-blue)" : "var(--tie-green)",
                  }}>
                    {reveal.actual.toUpperCase()}
                  </div>
                  <div style={{
                    marginTop: 8, fontSize: 14, fontWeight: 700,
                    color: reveal.correct === true ? "var(--signal-green)"
                      : reveal.correct === false ? "var(--banker-red)" : "var(--text-secondary)",
                  }}>
                    {reveal.guess === "skip" ? "Sat out — discipline noted"
                      : reveal.correct === null ? "Tie — push, no evidence"
                      : reveal.correct ? "✓ Confirmed read — added to your profile"
                      : "✗ Missed — discarded (not used in profile)"}
                  </div>
                </div>
                <button className="btn btn-gold" onClick={next}>
                  {cpIdx >= board.checkpoints.length ? "Board complete →" : "Next read →"}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 2 }}>
                  Read the screens as you would at the table. No pressure to call —
                  sitting out a hand you can't read is a profiled strength, not a miss.
                </div>
                <button className="btn skip-btn" onClick={() => answer("skip")}>
                  Sit Out (no read)
                </button>
                <button className="btn btn-banker" onClick={() => answer("banker")}>
                  庄 BANKER
                </button>
                <button className="btn btn-player" onClick={() => answer("player")}>
                  闲 PLAYER
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: the screens up to this point */}
        <div>
          <RoadsDisplay outcomes={shown} betsToggle={false} />
        </div>
      </div>
    </div>
  );
}
