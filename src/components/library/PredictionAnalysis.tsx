import { useMemo, useState } from "react";
import type { Session } from "../../mock/data";
import type { Outcome } from "../../game/baccarat";
import RoadsDisplay from "../roads/RoadsDisplay";
import { ENTITY_COLOURS, ENTITY_LABELS, type EntityId } from "../../lib/entities";

// Prediction analysis for a library session: how You / Sniper / Grinder
// would have called each game. Predictions are mocked until the signal
// engine lands, but deterministic per (session, entity, profile version)
// so the profile-drift dropdowns visibly move the stats.

const ENTITIES: EntityId[] = ["you", "sniper", "grinder"];

// Profile versions (drift): predictions differ per version. "As recorded"
// is the snapshot made at play time; later versions are backtests.
const PROFILE_VERSIONS: Record<EntityId, string[]> = {
  you:     ["v1 — as recorded", "v2 — 12 May", "v3 — current"],
  sniper:  ["v1 — as recorded", "v2 — retuned", "v3 — current"],
  grinder: ["v1 — as recorded", "v2 — current"],
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
function mockPredictions(
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

export default function PredictionAnalysis({ session }: { session: Session }) {
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
          {ENTITIES.map(id => {
            const s = statsFor(predictions[id], outcomes);
            return (
              <div key={id} className="scoreboard-entity">
                <div className="flex items-center" style={{ gap: 8 }}>
                  <span className="scoreboard-dot" style={{ background: ENTITY_COLOURS[id].correct }} />
                  <b style={{ fontSize: 13 }}>{ENTITY_LABELS[id]}</b>
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

        {/* Overlay legend (only when active) */}
        {view.entities.length > 0 && (
          <div className="overlay-legend" style={{ marginTop: 10, marginBottom: 0 }}>
            {view.entities.map(e => (
              <span key={e} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <b style={{ fontSize: 12 }}>{ENTITY_LABELS[e]}:</b>
                <span className="legend-line" style={{ background: ENTITY_COLOURS[e].correct }} /> correct
                <span className="legend-line" style={{ background: ENTITY_COLOURS[e].wrong }} /> incorrect
              </span>
            ))}
          </div>
        )}
      </div>

      {/* All roads stay visible; the Big Road carries the coloured tiles
          and prediction arrows when an overlay view is selected */}
      <RoadsDisplay
        outcomes={outcomes}
        betsToggle={false}
        analysisOverlay={view.entities.length > 0
          ? { entities: view.entities, predictions }
          : undefined}
      />
    </div>
  );
}
