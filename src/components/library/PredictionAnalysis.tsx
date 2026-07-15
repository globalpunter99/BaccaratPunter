import { useMemo, useState } from "react";
import type { Session } from "../../mock/data";
import type { Outcome } from "../../game/baccarat";

// Prediction analysis for a library session: how You / Sniper / Grinder
// would have called each game. Predictions are mocked until the signal
// engine lands, but deterministic per (session, entity, profile version)
// so the profile-drift dropdowns visibly move the stats.

export type EntityId = "you" | "sniper" | "grinder";

const ENTITIES: { id: EntityId; label: string }[] = [
  { id: "you", label: "You" },
  { id: "sniper", label: "Sniper" },
  { id: "grinder", label: "Grinder" },
];

// Profile versions (drift): predictions differ per version. "As recorded"
// is the snapshot made at play time; later versions are backtests.
const PROFILE_VERSIONS: Record<EntityId, string[]> = {
  you:     ["v1 — as recorded", "v2 — 12 May", "v3 — current"],
  sniper:  ["v1 — as recorded", "v2 — retuned", "v3 — current"],
  grinder: ["v1 — as recorded", "v2 — current"],
};

// Entity line colours: bright = correct call, dull = incorrect call.
export const ENTITY_COLOURS: Record<EntityId, { correct: string; wrong: string }> = {
  you:     { correct: "#ffd94a", wrong: "#8a7420" },
  sniper:  { correct: "#3ae8e8", wrong: "#1d7676" },
  grinder: { correct: "#f06bf0", wrong: "#7c3180" },
};

// Deterministic pseudo-random from a string seed
function seededRand(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    h = Math.imul(h ^ (h >>> 13), 3266489917);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Per-game predicted side, or null where the entity sat out. */
export function mockPredictions(
  sessionId: string, entity: EntityId, version: number, gameCount: number,
): (Outcome | null)[] {
  const rand = seededRand(`${sessionId}|${entity}|${version}`);
  // Entity personality: Sniper calls rarely, Grinder calls most games
  const callRate = entity === "sniper" ? 0.35 : entity === "grinder" ? 0.85 : 0.55;
  return Array.from({ length: gameCount }, () => {
    if (rand() > callRate) return null;
    return rand() < 0.53 ? "banker" : "player";
  });
}

export interface EntityStats {
  calls: number; wins: number; losses: number; ties: number; pct: number;
}

export function statsFor(preds: (Outcome | null)[], outcomes: Outcome[]): EntityStats {
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

// ── View selector (which entities' lines are overlaid) ──────────────────────
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

// ── Analysis bead plate: full-colour tiles + arrow-line overlay ──────────────
const ROWS = 6;
const CELL = 34;

function AnalysisBeadPlate({
  outcomes, predictions, activeEntities,
}: {
  outcomes: Outcome[];
  predictions: Record<EntityId, (Outcome | null)[]>;
  activeEntities: EntityId[];
}) {
  const cols = Math.max(Math.ceil(outcomes.length / ROWS), 15);
  const width = cols * CELL;
  const height = ROWS * CELL;

  const centre = (gameIdx: number) => ({
    x: Math.floor(gameIdx / ROWS) * CELL + CELL / 2,
    y: (gameIdx % ROWS) * CELL + CELL / 2,
  });

  // Vertical offset per entity so overlapping lines stay readable
  const offset: Record<EntityId, number> = { you: -6, sniper: 0, grinder: 6 };

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ position: "relative", width }}>
        {/* Full-colour tiles */}
        <div
          className="road-grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
            width,
          }}
        >
          {Array.from({ length: ROWS * cols }).map((_, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            const gameIdx = col * ROWS + row;
            const o = gameIdx < outcomes.length ? outcomes[gameIdx] : null;
            return (
              <div
                key={idx}
                className="road-cell"
                style={o ? {
                  background: o === "banker" ? "var(--banker-red)" : o === "player" ? "var(--player-blue)" : "var(--tie-green)",
                } : undefined}
              />
            );
          })}
        </div>

        {/* Arrow lines connecting each entity's consecutive calls */}
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          <defs>
            {activeEntities.map(e => (
              ["correct", "wrong"] as const).map(kind => (
                <marker
                  key={`${e}-${kind}`}
                  id={`arrow-${e}-${kind}`}
                  viewBox="0 0 8 8"
                  refX="7" refY="4"
                  markerWidth="5" markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0 L8 4 L0 8 Z" fill={ENTITY_COLOURS[e][kind]} />
                </marker>
              ))
            )}
          </defs>
          {activeEntities.map(e => {
            const preds = predictions[e];
            const called = preds
              .map((p, i) => (p ? i : -1))
              .filter(i => i >= 0 && i < outcomes.length);
            return called.slice(1).map((gameIdx, k) => {
              const from = centre(called[k]);
              const to = centre(gameIdx);
              const kind = outcomes[gameIdx] !== "tie" && preds[gameIdx] === outcomes[gameIdx] ? "correct" : "wrong";
              return (
                <line
                  key={`${e}-${gameIdx}`}
                  x1={from.x} y1={from.y + offset[e]}
                  x2={to.x} y2={to.y + offset[e]}
                  stroke={ENTITY_COLOURS[e][kind]}
                  strokeWidth={2.5}
                  markerEnd={`url(#arrow-${e}-${kind})`}
                  opacity={0.9}
                />
              );
            });
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function PredictionAnalysis({
  session, children,
}: { session: Session; children: React.ReactNode }) {
  const [viewId, setViewId] = useState("off");
  const [versions, setVersions] = useState<Record<EntityId, number>>({ you: 0, sniper: 0, grinder: 0 });

  const outcomes = session.hands.map(h => h.outcome);
  const view = VIEWS.find(v => v.id === viewId)!;

  const predictions = useMemo(() => ({
    you: mockPredictions(session.id, "you", versions.you, outcomes.length),
    sniper: mockPredictions(session.id, "sniper", versions.sniper, outcomes.length),
    grinder: mockPredictions(session.id, "grinder", versions.grinder, outcomes.length),
  }), [session.id, versions, outcomes.length]);

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
            onChange={e => setViewId(e.target.value)}
          >
            {VIEWS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div className="scoreboard-strip">
          {ENTITIES.map(({ id, label }) => {
            const s = statsFor(predictions[id], outcomes);
            return (
              <div key={id} className="scoreboard-entity">
                <div className="flex items-center" style={{ gap: 8 }}>
                  <span className="scoreboard-dot" style={{ background: ENTITY_COLOURS[id].correct }} />
                  <b style={{ fontSize: 13 }}>{label}</b>
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
              </div>
            );
          })}
        </div>
      </div>

      {view.entities.length > 0 ? (
        <div className="panel">
          <div className="panel-title">
            Prediction Overlay — {view.label}
          </div>
          <div className="overlay-legend">
            {view.entities.map(e => (
              <span key={e} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <b style={{ fontSize: 12 }}>{ENTITIES.find(x => x.id === e)!.label}:</b>
                <span className="legend-line" style={{ background: ENTITY_COLOURS[e].correct }} /> correct
                <span className="legend-line" style={{ background: ENTITY_COLOURS[e].wrong }} /> incorrect
              </span>
            ))}
          </div>
          <AnalysisBeadPlate
            outcomes={outcomes}
            predictions={predictions}
            activeEntities={view.entities}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
            Arrows link each entity's consecutive calls — unbroken bright runs show
            streaks of correct calls. Tiles: red = Banker, blue = Player, green = Tie.
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
