import { useMemo, useState } from "react";
import type { Session } from "../../mock/data";
import type { Outcome } from "../../game/baccarat";
import RoadsDisplay from "../roads/RoadsDisplay";
import { ENTITY_COLOURS, ENTITY_LABELS, type EntityId } from "../../lib/entities";
import { predictBoard } from "../../game/signals";
import { configForVersion } from "../../game/profile";
import { loadYouConfig } from "../../lib/profileStore";

// Prediction analysis for a library session: how You / Sniper / Grinder
// would have called each game. Calls come from the real signal engine
// (game/signals.ts) reading the roads under each entity's profile — a
// description of what that ruleset would have called on this recorded board,
// not a claim about independent rounds. The version dropdown selects the
// profile variant fed to the engine. The You "as recorded" lens and the
// money P/L read the session's REAL recorded plays (session.bets, saved by
// Live Session) — sessions without recorded plays honestly show none.

const ENTITIES: EntityId[] = ["you", "sniper", "grinder"];

// Profile options. For You these are two lenses on the SAME shoe:
//  index 0 — what the player actually did (their recorded bets/calls)
//  index 1 — what the player's system profile would have recommended
// (the player may have overridden the profile live, so the two differ).
// Sniper/Grinder are machine profiles that drift across saved versions.
const PROFILE_VERSIONS: Record<EntityId, string[]> = {
  you:     ["v1 — as recorded (bets/calls)", "v1 — system profile 10/10/26"],
  sniper:  ["v1 — as recorded", "v2 — retuned", "v3 — current"],
  grinder: ["v1 — as recorded", "v2 — current"],
};

function statsFor(preds: (Outcome | null)[], outcomes: Outcome[]) {
  let wins = 0, losses = 0, ties = 0, calls = 0;
  preds.forEach((p, i) => {
    if (!p) return;
    calls++;
    if (outcomes[i] === "tie") ties++;
    else if (p === outcomes[i]) wins++;
    else losses++;
  });
  const decided = wins + losses;
  return { calls, wins, losses, ties, pct: decided ? Math.round((wins / decided) * 100) : 0 };
}

// Winning-streak counts: each run of consecutive correct calls (losses reset,
// ties push and skipped games don't break a run) is counted once, in the
// bucket for its exact length — 1 / 2 / 3 / 4+ (no double counting).
function streakCounts(preds: (Outcome | null)[], outcomes: Outcome[]) {
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0, run = 0;
  const close = () => {
    if (run === 1) s1++;
    else if (run === 2) s2++;
    else if (run === 3) s3++;
    else if (run >= 4) s4++;
    run = 0;
  };
  preds.forEach((p, i) => {
    if (!p) return;               // skipped game — run continues
    if (outcomes[i] === "tie") return; // push — run continues
    if (p === outcomes[i]) run++;
    else close();
  });
  close();
  return { s1, s2, s3, s4 };
}

// View selector: which entities' arrow lines are overlaid on the Big Road
const VIEWS: { id: string; label: string; entities: EntityId[] }[] = [
  { id: "off", label: "Overlay: Off", entities: [] },
  { id: "you", label: "You only", entities: ["you"] },
  { id: "sniper", label: "Sniper only", entities: ["sniper"] },
  { id: "grinder", label: "Grinder only", entities: ["grinder"] },
  { id: "you-sniper", label: "You + Sniper", entities: ["you", "sniper"] },
  { id: "you-grinder", label: "You + Grinder", entities: ["you", "grinder"] },
  { id: "sniper-grinder", label: "Sniper + Grinder", entities: ["sniper", "grinder"] },
  { id: "all", label: "All three", entities: ["you", "sniper", "grinder"] },
];

type TypeFilter = Record<EntityId, { correct: boolean; wrong: boolean; nocall: boolean }>;
const ALL_ON = { correct: true, wrong: true, nocall: true };

export default function PredictionAnalysis({ session }: { session: Session }) {
  const [active, setActive] = useState<Set<EntityId>>(new Set());
  const [filter, setFilter] = useState<TypeFilter>({ you: { ...ALL_ON }, sniper: { ...ALL_ON }, grinder: { ...ALL_ON } });
  const [versions, setVersions] = useState<Record<EntityId, number>>({ you: 0, sniper: 0, grinder: 0 });

  const outcomes = session.hands.map(h => h.outcome);
  const activeArr = ENTITIES.filter(e => active.has(e));

  // Keep the dropdown in sync with the active set
  const sameSet = (a: EntityId[]) => a.length === activeArr.length && a.every(x => active.has(x));
  const viewId = VIEWS.find(v => sameSet(v.entities))?.id ?? "off";

  const isolate = (t: "correct" | "wrong" | "nocall") => ({
    correct: t === "correct", wrong: t === "wrong", nocall: t === "nocall",
  });

  function setView(id: string) {
    setActive(new Set(VIEWS.find(v => v.id === id)!.entities));
    setFilter({ you: { ...ALL_ON }, sniper: { ...ALL_ON }, grinder: { ...ALL_ON } });
  }
  // View pill: turning on shows all lines by default; turning off hides.
  function toggleView(e: EntityId) {
    const turningOn = !active.has(e);
    setActive(prev => {
      const n = new Set(prev);
      turningOn ? n.add(e) : n.delete(e);
      return n;
    });
    if (turningOn) setFilter(prev => ({ ...prev, [e]: { ...ALL_ON } }));
  }
  // Line-type tap:
  //  · profile off  → activate it and isolate to just this line
  //  · profile on, all lines showing → isolate to just this line
  //  · profile on, already filtered → toggle this line in/out
  function tapType(e: EntityId, t: "correct" | "wrong" | "nocall") {
    if (!active.has(e)) {
      setActive(prev => new Set(prev).add(e));
      setFilter(prev => ({ ...prev, [e]: isolate(t) }));
      return;
    }
    const f = filter[e];
    const applicable: ("correct" | "wrong" | "nocall")[] =
      e === "grinder" ? ["correct", "wrong"] : ["correct", "wrong", "nocall"];
    const allOn = applicable.every(k => f[k]);
    if (allOn) setFilter(prev => ({ ...prev, [e]: isolate(t) }));
    else setFilter(prev => ({ ...prev, [e]: { ...prev[e], [t]: !prev[e][t] } }));
  }

  // The player's saved profile (localStorage) drives the "You" engine config.
  const youConfig = useMemo(() => loadYouConfig(), []);

  // The player's ACTUAL plays this shoe (bets and stake-0 calls), recorded by
  // Live Session. Each play's main side becomes the call on that hand; hands
  // with no play stay null. Sessions with nothing recorded return all-null —
  // the as-recorded lens then honestly shows zero calls, never invented ones.
  const recordedPreds = useMemo<(Outcome | null)[]>(() => {
    const preds: (Outcome | null)[] = outcomes.map(() => null);
    for (const b of session.bets ?? []) {
      const side = b.slip.main?.side;
      if (side === "banker" || side === "player") preds[b.handId - 1] = side;
    }
    return preds;
  }, [session.bets, outcomes]);

  // Real money ledger from the recorded plays (stake-0 calls excluded).
  const money = useMemo(() => {
    let pl = 0, betWins = 0, betLosses = 0, betHands = 0;
    for (const b of session.bets ?? []) {
      if (b.staked <= 0) continue;
      betHands++;
      pl += b.profit;
      if (b.profit > 0) betWins++;
      else if (b.profit < 0) betLosses++;
    }
    return { pl, betWins, betLosses, betHands };
  }, [session.bets]);

  const predictions = useMemo(() => ({
    // You index 0 = the recorded plays; index 1+ = the system-profile engine.
    you: versions.you === 0
      ? recordedPreds
      : predictBoard(outcomes, configForVersion("you", versions.you, youConfig)),
    sniper: predictBoard(outcomes, configForVersion("sniper", versions.sniper, youConfig)),
    grinder: predictBoard(outcomes, configForVersion("grinder", versions.grinder, youConfig)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [session.id, versions, youConfig, recordedPreds]);

  // Tile-wash bet results always follow the selected You profile
  // Each hand's recorded markers (naturals, pairs, tigers/dragons, tie totals)
  // carried through so the roads and the side-bet counters show what was
  // actually dealt, with You's per-hand win/loss wash layered on top.
  const youExtras = useMemo(() => session.hands.map((h, i) => {
    const p = predictions.you[i];
    const betResult = p && h.outcome !== "tie"
      ? ((p === h.outcome ? "win" : "loss") as "win" | "loss")
      : undefined;
    return {
      natural: h.natural,
      bankerPair: h.bankerPair,
      playerPair: h.playerPair,
      variant: h.variant,
      tieTotal: h.tieTotal,
      betResult,
    };
  }), [predictions, session.hands]);

  return (
    <div>
      {/* Scoreboard strip with profile-drift dropdowns */}
      <div className="panel mb-12" style={{ padding: "10px 14px" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>Prediction Scoreboard</div>
          <select
            className="input"
            style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
            value={viewId}
            onChange={e => setView(e.target.value)}
          >
            {VIEWS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div className="scoreboard-strip">
          {ENTITIES.map(id => {
            const s = statsFor(predictions[id], outcomes);
            const st = streakCounts(predictions[id], outcomes);
            const on = active.has(id);
            return (
              <div key={id} className="scoreboard-entity" data-active={on || undefined}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  {/* Left: label, dropdown, stats, streaks */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center" style={{ gap: 8 }}>
                      <span className="scoreboard-label">
                        <span className="scoreboard-dot" style={{ background: ENTITY_COLOURS[id].correct }} />
                        {ENTITY_LABELS[id]}
                      </span>
                      <select
                        className="input"
                        style={{ width: "auto", padding: "2px 6px", fontSize: 11 }}
                        value={versions[id]}
                        onChange={e => setVersions(v => ({ ...v, [id]: Number(e.target.value) }))}
                      >
                        {PROFILE_VERSIONS[id].map((v, i) => <option key={i} value={i}>{v}</option>)}
                      </select>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      {s.calls} calls · <b style={{ color: "var(--tie-green)" }}>{s.wins}</b> (W){" "}
                      <b style={{ color: "var(--banker-red)" }}>{s.losses}</b> (L){" "}
                      <b>{s.ties}</b> (T) · <b style={{ color: "var(--gold)" }}>{s.pct}%</b>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}
                      title="How many times this profile won that many calls in a row (each run counted once)">
                      Win Streaks: 1 win = <b style={{ color: "var(--tie-green)" }}>{st.s1}</b>
                      <span className="streak-sep">·</span>2 win = <b style={{ color: "var(--tie-green)" }}>{st.s2}</b>
                      <span className="streak-sep">·</span>3 win = <b style={{ color: "var(--tie-green)" }}>{st.s3}</b>
                      <span className="streak-sep">·</span>4+ = <b style={{ color: "var(--tie-green)" }}>{st.s4}</b>
                    </div>
                  </div>

                  {/* Right: compact P/L box (You, as-recorded lens) — the REAL
                      money ledger from the session's recorded bets */}
                  {id === "you" && versions.you === 0 && (() => {
                    if (money.betHands === 0) return (
                      <div className="pl-box">
                        <div className="pl-box-label">Profit / (Loss)</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No recorded bets</div>
                      </div>
                    );
                    const won = money.pl >= 0;
                    return (
                      <div className="pl-box">
                        <div className="pl-box-label">Profit / (Loss)</div>
                        <div className="pl-box-amount" style={{ color: won ? "var(--tie-green)" : "var(--banker-red)" }}>
                          {won ? `$${money.pl}` : `($${Math.abs(money.pl)})`}
                        </div>
                        <div className="pl-box-sub">
                          {won ? "Won" : "Loss"} · {won ? `${money.betWins} W` : `${money.betLosses} L`} / {money.betHands} bets
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Per-entity legend: View on/off pill + line-type filters (centred) */}
                <div className="entity-legend">
                  <button className="view-pill" data-on={on || undefined}
                    onClick={() => toggleView(id)} title="Show / hide this profile on the roads">
                    <span className="view-switch"><span className="view-switch-knob" /></span>
                    View
                  </button>
                  <button className="type-btn" data-on={(on && filter[id].correct) || undefined}
                    onClick={() => tapType(id, "correct")}>
                    <span className="legend-line" style={{ background: ENTITY_COLOURS[id].correct }} /> Correct
                  </button>
                  <button className="type-btn" data-on={(on && filter[id].wrong) || undefined}
                    onClick={() => tapType(id, "wrong")}>
                    <span className="legend-line" style={{ background: ENTITY_COLOURS[id].wrong }} /> Incorrect
                  </button>
                  {id !== "grinder" && (
                    <button className="type-btn" data-on={(on && filter[id].nocall) || undefined}
                      onClick={() => tapType(id, "nocall")}>
                      <span className="legend-line legend-line-dashed" /> No call
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* All roads stay visible; the Big Road carries the coloured tiles
          and prediction arrows for the active profiles */}
      <RoadsDisplay
        outcomes={outcomes}
        extras={youExtras}
        betsToggleLabel="Bets/Calls"
        analysisOverlay={activeArr.length > 0
          ? { entities: activeArr, predictions, filter }
          : undefined}
        screenId={`session-${session.id}`}
        canDeletePhotos
        enableFocusView
      />
    </div>
  );
}
