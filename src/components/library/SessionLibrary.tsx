import { useMemo, useState } from "react";
import { mockSessions, type Session } from "../../mock/data";
import type { Outcome } from "../../game/baccarat";
import PredictionAnalysis from "./PredictionAnalysis";
import PracticePlayer from "../practice/PracticeReplay";
import ScreenPhotos from "../roads/ScreenPhotos";
import {
  addSavedSession, deleteSession, loadFavourites, loadHiddenSessions,
  loadSavedSessions, toggleFavourite,
} from "../../lib/sessionStore";
import { predictBoard } from "../../game/signals";
import { configForVersion, type ProfileConfig } from "../../game/profile";
import { loadYouConfig } from "../../lib/profileStore";
import { loadPayoutSettings } from "../../lib/payoutSettings";
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
  const [filter, setFilter] = useState<"all" | "live" | "extra" | "practice" | "fav">("all");
  const [casinoFilter, setCasinoFilter] = useState<string>("all"); // "all" | "others" | casino name
  const [showStats, setShowStats] = useState(false); // eye toggle: B/P/T hidden by default
  const [saved, setSaved] = useState<Session[]>(() => loadSavedSessions());
  const [favs, setFavs] = useState<string[]>(() => loadFavourites());
  const [hidden, setHidden] = useState<string[]>(() => loadHiddenSessions());
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);

  // findSession searches every session (even hidden) so links still resolve;
  // the visible list below excludes hidden ones.
  const findSession = (id?: string) => [...saved, ...mockSessions].find(s => s.id === id);
  const allSessions = [...saved, ...mockSessions].filter(s => !hidden.includes(s.id));

  // Casinos configured in Settings form the "database" the casino filter draws
  // on; any session whose venue isn't one of them falls under "Others".
  const knownCasinos = useMemo(() => loadPayoutSettings().casinos.map(c => c.name), []);
  const knownLower = useMemo(
    () => new Set(knownCasinos.map(n => n.trim().toLowerCase())), [knownCasinos]);
  const isKnownCasino = (venue: string) => knownLower.has(venue.trim().toLowerCase());

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
  }, [saved, hidden, youConfig]);

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

  function confirmDelete() {
    if (!deleteTarget) return;
    deleteSession(deleteTarget.id);
    setHidden(loadHiddenSessions());
    setSaved(loadSavedSessions());
    setDeleteTarget(null);
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
  const matchesCasino = (s: Session) => {
    if (casinoFilter === "all") return true;
    if (casinoFilter === "others") return !isKnownCasino(s.venue);
    return s.venue.trim().toLowerCase() === casinoFilter.trim().toLowerCase();
  };
  const filtered = allSessions.filter(s => {
    if (!matchesCasino(s)) return false;
    if (filter === "fav") return favs.includes(s.id);
    if (filter === "live") return s.type === "live";
    if (filter === "extra") return s.type === "extra";
    if (filter === "practice") return !!s.practiceOf;
    return true;
  });

  // Only offer "Others" when some session venue isn't a configured casino.
  const hasOthers = allSessions.some(s => !isKnownCasino(s.venue));

  const counts = {
    all: allSessions.length,
    live: allSessions.filter(s => s.type === "live").length,
    extra: allSessions.filter(s => s.type === "extra").length,
    practice: allSessions.filter(s => !!s.practiceOf).length,
    fav: allSessions.filter(s => favs.includes(s.id)).length,
  };
  // Two-line labels: name on top, count below (see .filter-btn styling).
  const filterMeta: Record<typeof filter, { name: string; count: number }> = {
    all: { name: "All", count: counts.all },
    live: { name: "Live Only", count: counts.live },
    extra: { name: "Uploaded Only", count: counts.extra },
    practice: { name: "Practice", count: counts.practice },
    fav: { name: "★ Favourites", count: counts.fav },
  };

  return (
    <div className="page">
      <div className="page-title" style={{ marginBottom: 10 }}>Session Library</div>
      <div className="library-filter-row">
        <select
          className="input"
          style={{ padding: "6px 10px", fontSize: 12, width: 170, flexShrink: 0 }}
          title="Filter by casino (casinos come from Settings; unlisted venues are Others)"
          value={casinoFilter}
          onChange={e => setCasinoFilter(e.target.value)}
        >
          <option value="all">All Casinos</option>
          {knownCasinos.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
          {hasOthers && <option value="others">Others</option>}
        </select>
        <div className="library-filter-group">
          <button
            className={`btn filter-btn ${showStats ? "btn-gold" : "btn-ghost"}`}
            title="Show or hide Banker / Player / Tie counts on every card"
            onClick={() => setShowStats(v => !v)}
          >
            <span className="filter-btn-name">👁 B/P/T</span>
            <span className="filter-btn-count">{showStats ? "shown" : "hidden"}</span>
          </button>
          {(["all", "live", "extra", "practice", "fav"] as const).map(f => (
            <button
              key={f}
              className={`btn filter-btn ${filter === f ? "btn-gold" : "btn-ghost"}`}
              onClick={() => setFilter(f)}
            >
              <span className="filter-btn-name">{filterMeta[f].name}</span>
              <span className="filter-btn-count">({filterMeta[f].count})</span>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.map(s => {
          const original = s.practiceOf ? findSession(s.practiceOf) : undefined;
          const isFav = favs.includes(s.id);
          const bw = bestMap.get(s.id);
          return (
            <div key={s.id} className="panel session-card">
              {/* Left — favourite + title + meta */}
              <button
                className="fav-star"
                data-on={isFav || undefined}
                title={isFav ? "Remove from favourites" : "Add to favourites"}
                onClick={() => toggleFav(s.id)}
              >
                {isFav ? "★" : "☆"}
              </button>
              <div className="session-title">
                <div className="session-title-line">
                  <span className="session-venue">{s.venue}</span>
                  <span className={`session-badge ${s.practiceOf ? "practice" : s.type}`}>
                    {s.practiceOf ? "Practice" : s.type === "live" ? "Live" : "Uploaded"}
                  </span>
                </div>
                <div className="session-meta">
                  {s.tableNumber} · {s.date}
                  {s.practiceOf && (original
                    ? <> · <button className="link-btn" onClick={() => setMode({ kind: "analyse", session: original })}>↳ practice of {original.id}</button></>
                    : <> · ↳ practice of {s.practiceOf}</>)}
                </div>
              </div>

              {/* Middle — best win predictions + notes (fills the empty space) */}
              <div className="session-mid">
                {bw && (
                  <div className="best-wins">
                    <span className="best-label">Best:</span>
                    {ENTITIES.map(e => (
                      <span key={e} className="best-chip"
                        title={`${ENTITY_LABELS[e]} best version: ${bw[e].wins} correct of ${bw[e].calls} calls`}>
                        <span className="best-dot" style={{ background: ENTITY_COLOURS[e].correct }} />
                        <span style={{ color: "var(--text-secondary)" }}>{ENTITY_LABELS[e]}</span>
                        <b style={{ color: ENTITY_COLOURS[e].correct }}>{bw[e].wins}</b>
                        <span style={{ color: "var(--text-muted)" }}>/{bw[e].calls}</span>
                      </span>
                    ))}
                  </div>
                )}
                {s.notes && <div className="session-note" title={s.notes}>{s.notes}</div>}
              </div>

              {/* Right — hands + controls */}
              <div className="session-actions">
                <div className="session-hands">
                  {s.hands.length} hands
                  {showStats && (
                    <span className="session-bpt">
                      <span className="text-red">B:{bankerCount(s)}</span>{" "}
                      <span className="text-blue">P:{playerCount(s)}</span>{" "}
                      <span className="text-green">T:{tieCount(s)}</span>
                    </span>
                  )}
                </div>
                <ScreenPhotos screenId={`session-${s.id}`} canDelete />
                <button className="btn btn-secondary" style={{ fontSize: 12, padding: "5px 10px" }}
                  onClick={() => setMode({ kind: "practice", session: s })}>
                  ▶ Practice
                </button>
                <button className="btn btn-gold" style={{ fontSize: 12, padding: "5px 10px" }}
                  onClick={() => setMode({ kind: "analyse", session: s })}>
                  Analyse
                </button>
                <button className="session-del" title="Delete session" onClick={() => setDeleteTarget(s)}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {deleteTarget && (
        <div className="info-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="info-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete this session?</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
              <b style={{ color: "var(--text-primary)" }}>{deleteTarget.venue}</b> · {deleteTarget.tableNumber} · {deleteTarget.date} will
              be permanently removed from your library. <b style={{ color: "var(--banker-red)" }}>This cannot be undone —
              a deleted session can't be restored.</b> It may also affect your player profile, which calibrates
              from your recorded sessions.
            </div>
            <div className="flex gap-8" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn" style={{ background: "var(--banker-red)", color: "#fff" }} onClick={confirmDelete}>
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
