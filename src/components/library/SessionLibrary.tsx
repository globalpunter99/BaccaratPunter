import { useMemo, useState } from "react";
import { mockSessions, type Session } from "../../mock/data";
import type { Outcome } from "../../game/baccarat";
import PredictionAnalysis from "./PredictionAnalysis";
import PracticePlayer from "../practice/PracticeReplay";
import ScreenPhotos from "../roads/ScreenPhotos";
import {
  addSavedSession, loadFavourites, loadSavedSessions, toggleFavourite,
} from "../../lib/sessionStore";
import { predictBoard } from "../../game/signals";
import { configForVersion, type ProfileConfig } from "../../game/profile";
import { loadYouConfig } from "../../lib/profileStore";
import { ENTITY_COLOURS, ENTITY_LABELS, type EntityId } from "../../lib/entities";

const ENTITIES: EntityId[] = ["you", "sniper", "grinder"];
// Distinct profile versions per entity (see configForVersion).
const VERSION_COUNT: Record<EntityId, number> = { you: 2, sniper: 3, grinder: 2 };

// The best a profile could have done on this shoe: across its version variants,
// the one yielding the most correct calls (highest win predictions).
function bestWins(outcomes: Outcome[], entity: EntityId, youConfig: ProfileConfig) {
  let best = { wins: 0, calls: 0 };
  for (let v = 0; v < VERSION_COUNT[entity]; v++) {
    const calls = predictBoard(outcomes, configForVersion(entity, v, youConfig));
    let wins = 0, decided = 0;
    calls.forEach((call, i) => {
      if (!call || outcomes[i] === "tie") return;
      decided++;
      if (call === outcomes[i]) wins++;
    });
    if (v === 0 || wins > best.wins) best = { wins, calls: decided };
  }
  return best;
}

// The Session Library is the single home for recorded shoes. Each card offers
// two ways in: Analyse (study only — no betting or calling) and Practice (play
// the shoe blind). The former Practice tab was folded in here. A finished
// practice run can be saved back as a new, linked session.

type Mode =
  | { kind: "list" }
  | { kind: "analyse"; session: Session }
  | { kind: "practice"; session: Session };

export default function SessionLibrary() {
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [filter, setFilter] = useState<"all" | "live" | "extra" | "fav">("all");
  const [showStats, setShowStats] = useState(false); // eye toggle: B/P/T hidden by default
  const [saved, setSaved] = useState<Session[]>(() => loadSavedSessions());
  const [favs, setFavs] = useState<string[]>(() => loadFavourites());

  const allSessions = [...saved, ...mockSessions];
  const findSession = (id?: string) => allSessions.find(s => s.id === id);

  const bankerCount = (s: Session) => s.hands.filter(h => h.outcome === "banker").length;
  const playerCount = (s: Session) => s.hands.filter(h => h.outcome === "player").length;
  const tieCount    = (s: Session) => s.hands.filter(h => h.outcome === "tie").length;

  // Best-version win counts per profile, per session (see bestWins).
  const youConfig = useMemo(() => loadYouConfig(), []);
  const bestMap = useMemo(() => {
    const m = new Map<string, Record<EntityId, { wins: number; calls: number }>>();
    for (const s of allSessions) {
      const o = s.hands.map(h => h.outcome);
      m.set(s.id, {
        you: bestWins(o, "you", youConfig),
        sniper: bestWins(o, "sniper", youConfig),
        grinder: bestWins(o, "grinder", youConfig),
      });
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, youConfig]);

  function backToList() {
    setSaved(loadSavedSessions());
    setFavs(loadFavourites());
    setMode({ kind: "list" });
  }

  // Persist a practice save, then drop the user on the new session's analyse
  // view so they can see it saved and linked to the original.
  function handleSave(draft: Session) {
    const savedSession = addSavedSession(draft);
    setSaved(loadSavedSessions());
    setMode({ kind: "analyse", session: savedSession });
  }

  function toggleFav(id: string) {
    setFavs(toggleFavourite(id));
  }

  // ── Practice mode ──
  if (mode.kind === "practice") {
    return <PracticePlayer session={mode.session} onBack={backToList} onSave={handleSave} />;
  }

  // ── Analyse mode ──
  if (mode.kind === "analyse") {
    const s = mode.session;
    const original = s.practiceOf ? findSession(s.practiceOf) : undefined;
    return (
      <div className="page">
        <div className="flex items-center justify-between mb-12">
          <div>
            <div className="page-title">Analyse — {s.venue}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {s.tableNumber} · {s.date} · study only, no betting or calling
            </div>
          </div>
          <div className="flex gap-8 items-center">
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 14px" }}
              onClick={() => setMode({ kind: "practice", session: s })}>
              ▶ Practice this shoe
            </button>
            <button className="btn btn-ghost" onClick={backToList}>← Back to Library</button>
          </div>
        </div>

        {s.practiceOf && (
          <div className="mb-12" style={{
            padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: 13,
            background: "rgba(245,200,66,0.08)", border: "1px solid var(--gold)", color: "var(--text-secondary)",
          }}>
            💾 Saved practice session.
            {original
              ? <> Original shoe: <button className="link-btn" onClick={() => setMode({ kind: "analyse", session: original })}>{original.venue} ({original.id}) →</button></>
              : <> Original shoe {s.practiceOf} is no longer in the library.</>}
          </div>
        )}

        {s.notes && (
          <div className="mb-12" style={{ padding: "8px 12px", background: "var(--bg-dark)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--text-secondary)" }}>
            {s.notes}
          </div>
        )}

        <PredictionAnalysis session={s} />
      </div>
    );
  }

  // ── List mode ──
  const filtered = allSessions.filter(s => {
    if (filter === "fav") return favs.includes(s.id);
    if (filter === "live") return s.type === "live";
    if (filter === "extra") return s.type === "extra";
    return true;
  });

  const counts = {
    all: allSessions.length,
    live: allSessions.filter(s => s.type === "live").length,
    extra: allSessions.filter(s => s.type === "extra").length,
    fav: allSessions.filter(s => favs.includes(s.id)).length,
  };
  const filterLabel: Record<typeof filter, string> = {
    all: `All (${counts.all})`,
    live: `Live Only (${counts.live})`,
    extra: `Uploaded Only (${counts.extra})`,
    fav: `★ Favourites (${counts.fav})`,
  };

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-12">
        <div className="page-title">Session Library</div>
        <div className="flex gap-8 items-center">
          <button
            className={`btn ${showStats ? "btn-gold" : "btn-ghost"}`}
            style={{ padding: "5px 12px", fontSize: 12 }}
            title="Show or hide Banker / Player / Tie counts on every card"
            onClick={() => setShowStats(v => !v)}
          >
            {showStats ? "👁 B/P/T shown" : "👁 B/P/T hidden"}
          </button>
          {(["all", "live", "extra", "fav"] as const).map(f => (
            <button
              key={f}
              className={`btn ${filter === f ? "btn-gold" : "btn-ghost"}`}
              style={{ padding: "5px 14px", fontSize: 12 }}
              onClick={() => setFilter(f)}
            >
              {filterLabel[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Concise mode explanation */}
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
        <b style={{ color: "var(--text-secondary)" }}>Analyse</b> — study the shoe's roads, predictions and scoreboard; no betting or calling.
        {"  "}<b style={{ color: "var(--text-secondary)" }}>Practice</b> — play the shoe blind, calling or betting each hand before the result is revealed.
      </div>

      {filtered.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
          {filter === "fav" ? "No favourites yet — tap a ★ on a session to mark it." : "No sessions."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(s => {
          const original = s.practiceOf ? findSession(s.practiceOf) : undefined;
          const isFav = favs.includes(s.id);
          return (
            <div key={s.id} className="panel">
              <div className="flex items-center justify-between">
                <div className="flex gap-12 items-center">
                  <button
                    className="fav-star"
                    data-on={isFav || undefined}
                    title={isFav ? "Remove from favourites" : "Add to favourites"}
                    onClick={() => toggleFav(s.id)}
                  >
                    {isFav ? "★" : "☆"}
                  </button>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.venue}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {s.tableNumber} · {s.date}
                    </div>
                    {s.practiceOf && (
                      <div style={{ fontSize: 11, marginTop: 3 }}>
                        {original
                          ? <button className="link-btn" onClick={() => setMode({ kind: "analyse", session: original })}>↳ practice of {original.venue} ({original.id})</button>
                          : <span style={{ color: "var(--text-muted)" }}>↳ practice of {s.practiceOf}</span>}
                      </div>
                    )}
                  </div>
                  <span className={`session-badge ${s.practiceOf ? "practice" : s.type}`}>
                    {s.practiceOf ? "Practice" : s.type === "live" ? "Live" : "Uploaded"}
                  </span>
                </div>

                <div className="flex gap-12 items-center">
                  <div style={{ fontSize: 13, textAlign: "right" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{s.hands.length} hands</span>
                    {showStats && (
                      <span>
                        {"  "}<span className="text-red">B:{bankerCount(s)}</span>{" "}
                        <span className="text-blue">P:{playerCount(s)}</span>{" "}
                        <span className="text-green">T:{tieCount(s)}</span>
                      </span>
                    )}
                  </div>
                  <ScreenPhotos screenId={`session-${s.id}`} canDelete />
                  <button className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }}
                    onClick={() => setMode({ kind: "practice", session: s })}>
                    ▶ Practice
                  </button>
                  <button className="btn btn-gold" style={{ fontSize: 12, padding: "6px 12px" }}
                    onClick={() => setMode({ kind: "analyse", session: s })}>
                    Analyse
                  </button>
                </div>
              </div>

              {/* Best win predictions per profile (best version for this shoe) */}
              {(() => {
                const bw = bestMap.get(s.id);
                if (!bw) return null;
                return (
                  <div style={{ marginTop: 8, fontSize: 12, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ color: "var(--text-muted)" }}>Best win predictions:</span>
                    {ENTITIES.map(e => (
                      <span key={e} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                        title={`${ENTITY_LABELS[e]} best version: ${bw[e].wins} correct of ${bw[e].calls} calls`}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: ENTITY_COLOURS[e].correct }} />
                        <span style={{ color: "var(--text-secondary)" }}>{ENTITY_LABELS[e]}</span>
                        <b style={{ color: ENTITY_COLOURS[e].correct }}>{bw[e].wins}</b>
                        <span style={{ color: "var(--text-muted)" }}>/ {bw[e].calls}</span>
                      </span>
                    ))}
                  </div>
                );
              })()}

              {s.notes && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                  {s.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
