import { useMemo, useState } from "react";
import RoadsDisplay from "../roads/RoadsDisplay";
import ProfileBuilder from "./ProfileBuilder";
import ProfileCalibration from "./ProfileCalibration";
import { ENTITY_COLOURS, ENTITY_LABELS, type EntityId } from "../../lib/entities";
import { hasProfile, loadAnswers, loadYouConfig } from "../../lib/profileStore";
import {
  deriveTraits, leanLabel, loadCalibration,
} from "../../lib/calibrationStore";
import { FOUNDATION_BOARDS } from "../../mock/foundationGames";
import { configForVersion, type ProfileConfig } from "../../game/profile";
import { runSignals } from "../../game/signals";
import { mockProfileStats, mockSessions } from "../../mock/data";
import type { Outcome } from "../../game/baccarat";

// The Profile hub: one page where the player can see and work each phase of
// a profile — Establish (questionnaire), Calibrate (guess-the-hand on the
// foundation boards), Upgrade (session data feeding refinements) and Review
// (the profile itself, in numbers AND recalled screens) — for You and for the
// two machine benchmarks, Sniper and Grinder.
//
// The purpose of the profile is discipline: knowing what a strong-conviction
// hand looks like FOR THIS PLAYER, so the app can back them to bet those and
// sit out the rest. Copy on this page keeps that framing.

type Phase = "establish" | "calibrate" | "upgrade" | "review";

const PHASES: { id: Phase; label: string }[] = [
  { id: "establish", label: "1 · Establish" },
  { id: "calibrate", label: "2 · Calibrate" },
  { id: "upgrade", label: "3 · Upgrade" },
  { id: "review", label: "4 · Review" },
];

const ENTITIES: EntityId[] = ["you", "sniper", "grinder"];

const MACHINE_VERSIONS: Record<"sniper" | "grinder", string[]> = {
  sniper: ["current", "looser retune", "tighter retune"],
  grinder: ["current", "pickier retune"],
};

export default function ProfileHub() {
  const [entity, setEntity] = useState<EntityId>("you");
  const [phase, setPhase] = useState<Phase>("review");
  const [showBuilder, setShowBuilder] = useState(false);
  // Bumped after the questionnaire closes so saved-state re-reads.
  const [, setRefresh] = useState(0);

  const cal = loadCalibration();
  const calDone = cal.completed.length;
  const traits = useMemo(() => deriveTraits(cal, FOUNDATION_BOARDS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cal.answers.length, cal.completed.length]);

  if (showBuilder) {
    return (
      <div className="page" style={{ maxWidth: 680 }}>
        <button className="btn btn-ghost mb-12" onClick={() => { setShowBuilder(false); setRefresh(r => r + 1); }}>
          ← Back to Profile
        </button>
        <ProfileBuilder onExit={() => { setShowBuilder(false); setRefresh(r => r + 1); }} />
      </div>
    );
  }

  // Phase status chips per entity
  function statusFor(e: EntityId, p: Phase): { label: string; tone: "done" | "active" | "wait" } {
    if (e !== "you") {
      if (p === "establish" || p === "calibrate") return { label: "Factory", tone: "done" };
      if (p === "upgrade") return { label: "Self-tuning · backend", tone: "wait" };
      return { label: "Ready", tone: "done" };
    }
    if (p === "establish") return hasProfile()
      ? { label: "Done", tone: "done" } : { label: "Start here", tone: "active" };
    if (p === "calibrate") {
      if (calDone >= FOUNDATION_BOARDS.length) return { label: "Done", tone: "done" };
      if (calDone > 0) return { label: `${calDone}/${FOUNDATION_BOARDS.length} boards`, tone: "active" };
      return hasProfile() ? { label: "Next", tone: "active" } : { label: "After step 1", tone: "wait" };
    }
    if (p === "upgrade") return { label: "Awaits backend", tone: "wait" };
    return { label: "Ready", tone: "done" };
  }

  const toneColour = { done: "var(--tie-green)", active: "var(--gold)", wait: "var(--text-muted)" };

  return (
    <div className="page">
      <div className="page-title">Player Profiles</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16, maxWidth: 760 }}>
        A profile exists to protect your discipline at the table: it defines what a
        strong-conviction hand looks like for you, so the app can back you to bet those —
        and back you to sit out everything else. Build yours in four phases, and compare it
        against the two machine benchmarks.
      </div>

      {/* Entity selector */}
      <div className="grid-3 mb-12">
        {ENTITIES.map(e => {
          const on = entity === e;
          const col = ENTITY_COLOURS[e].correct;
          return (
            <div
              key={e}
              className="panel"
              onClick={() => setEntity(e)}
              style={{
                cursor: "pointer", borderTop: `3px solid ${col}`,
                outline: on ? `1px solid ${col}` : "none", padding: "12px 16px",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: col }}>{ENTITY_LABELS[e]}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {e === "you"
                  ? hasProfile()
                    ? calDone >= FOUNDATION_BOARDS.length ? "Established · calibrated" : "Established · calibration in progress"
                    : "Not established yet"
                  : e === "sniper" ? "Machine benchmark — selective" : "Machine benchmark — high volume"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Phase stepper */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
        {PHASES.map(p => {
          const st = statusFor(entity, p.id);
          const on = phase === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPhase(p.id)}
              className="panel"
              style={{
                cursor: "pointer", textAlign: "left", padding: "10px 12px",
                border: `1px solid ${on ? "var(--border-accent)" : "var(--border-panel)"}`,
                background: on ? "rgba(245,200,66,0.06)" : undefined,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: on ? "var(--gold)" : "var(--text-primary)" }}>
                {p.label}
              </div>
              <div style={{ fontSize: 11, color: toneColour[st.tone], marginTop: 2 }}>{st.label}</div>
            </button>
          );
        })}
      </div>

      {/* Phase content */}
      {phase === "establish" && <EstablishSection entity={entity} onStartBuilder={() => setShowBuilder(true)} />}
      {phase === "calibrate" && (entity === "you"
        ? <ProfileCalibration />
        : <MachineCalibrateSection entity={entity} />)}
      {phase === "upgrade" && <UpgradeSection entity={entity} />}
      {phase === "review" && <ReviewSection entity={entity} traits={traits} />}
    </div>
  );
}

// ── Establish ─────────────────────────────────────────────────────────────

function EstablishSection({ entity, onStartBuilder }: { entity: EntityId; onStartBuilder: () => void }) {
  if (entity !== "you") {
    const cfg = configForVersion(entity, 0, loadYouConfig());
    return (
      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="panel-title">{ENTITY_LABELS[entity]} — established at the factory</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
          {entity === "sniper"
            ? "Sniper is the selective benchmark: it needs road agreement and high conviction before it calls, and sits out conflicted screens. If your reads can't beat Sniper's discipline, the answer is usually fewer hands, not different ones."
            : "Grinder is the volume benchmark: it calls almost every readable hand at the base rate. It exists as your floor — anything your profile can't do better than Grinder isn't adding value."}
        </div>
        <KnobsPanel cfg={cfg} />
      </div>
    );
  }

  const answers = loadAnswers();
  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <div className="panel-title">Establish your profile — the questionnaire</div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
        Most players can't describe their style in words — so we don't ask you to.
        The questionnaire captures how you play in broad strokes; the calibration
        boards in phase 2 then watch how you actually read screens.
      </div>
      {answers ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {[
              ["How often you play", answers.sessionFrequency],
              ["Entry approach", answers.primaryStrategy],
              ["Roads alignment needed", answers.minimumRoadsAligned],
              ["Streak or chop", answers.streakOrChop],
              ["When roads conflict", answers.sitOutThreshold],
              ["Hands per shoe", answers.handsPerSession],
              ["Minimum conviction", answers.confidenceThreshold],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{label}</span>
                <span style={{ color: "var(--gold)", fontWeight: 600, textAlign: "right" }}>{value || "—"}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={onStartBuilder}>Redo questionnaire</button>
        </>
      ) : (
        <button className="btn btn-gold" onClick={onStartBuilder}>Start the questionnaire →</button>
      )}
    </div>
  );
}

// ── Calibrate (machines) ──────────────────────────────────────────────────

function MachineCalibrateSection({ entity }: { entity: "sniper" | "grinder" }) {
  const cfg = configForVersion(entity, 0, loadYouConfig());
  // Real engine reads on the foundation boards — the machine's "calibration".
  const rows = FOUNDATION_BOARDS.map(b => {
    const sigs = runSignals(b.outcomes, cfg);
    let calls = 0, wins = 0;
    sigs.forEach((s, i) => {
      if (!s || !s.window || b.outcomes[i] === "tie") return;
      calls++;
      if (s.predictedSide === b.outcomes[i]) wins++;
    });
    return { board: b, calls, wins };
  });
  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <div className="panel-title">{ENTITY_LABELS[entity]} — calibrated on the foundation set</div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
        The machine profiles run the same foundation boards you calibrate on.
        This is how {ENTITY_LABELS[entity]} read them — note how the call volume
        moves with each board's character.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(({ board, calls, wins }) => (
          <div key={board.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ color: "var(--text-secondary)" }}>
              {board.title} · <span style={{ color: "var(--text-muted)" }}>{board.character}</span>
            </span>
            <span>
              <b style={{ color: "var(--gold)" }}>{calls}</b> calls ·{" "}
              <b style={{ color: "var(--tie-green)" }}>{wins}</b> hit
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Upgrade ───────────────────────────────────────────────────────────────

function UpgradeSection({ entity }: { entity: EntityId }) {
  if (entity !== "you") {
    const versions = MACHINE_VERSIONS[entity];
    return (
      <div className="panel" style={{ maxWidth: 640 }}>
        <div className="panel-title">{ENTITY_LABELS[entity]} — version history</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
          Machine profiles retune as data accumulates. Each version below is a real
          engine parameterisation — select them in the Library scoreboard to compare
          how they would have read a recorded shoe. Automatic self-tuning arrives
          with the backend pass.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {versions.map((label, i) => {
            const cfg = configForVersion(entity, i, loadYouConfig());
            return (
              <div key={i} style={{ background: "var(--bg-dark)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)", marginBottom: 4 }}>
                  v{i + 1} — {label}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Conviction ≥ {cfg.confidenceThreshold}% · {cfg.minRoadsAligned} roads aligned ·{" "}
                  {cfg.sitOutOnConflict ? "sits out conflicts" : "plays through conflicts"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="panel" style={{ maxWidth: 640 }}>
      <div className="panel-title">Upgrading your profile — session data</div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
        After calibration, every session you record live or upload keeps refining the
        profile: the profiler retests the same kinds of positions across new shoes,
        watches for style drift, and re-weights what a "window" means for you.
        Persistence needs the backend — nothing is feeding yet.
      </div>
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div className="stat-block">
          <div className="stat-value">0</div>
          <div className="stat-label">Live sessions feeding</div>
        </div>
        <div className="stat-block">
          <div className="stat-value">0</div>
          <div className="stat-label">Uploaded boards feeding</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
        Preview — once the backend lands, sessions like these will feed the profiler:
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {mockSessions.slice(0, 3).map(s => (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ color: "var(--text-secondary)" }}>{s.venue} · {s.date}</span>
            <span style={{ color: "var(--text-muted)" }}>{s.hands.length} games → confirmed reads extracted</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Review ────────────────────────────────────────────────────────────────

function ReviewSection({ entity, traits }: {
  entity: EntityId;
  traits: ReturnType<typeof deriveTraits>;
}) {
  const youConfig = loadYouConfig();
  const cfg = configForVersion(entity, 0, youConfig);

  return (
    <div>
      <div className="grid-2 mb-12" style={{ alignItems: "start" }}>
        <div className="panel">
          <div className="panel-title">{ENTITY_LABELS[entity]} — profile parameters</div>
          <KnobsPanel cfg={cfg} />
        </div>

        <div className="panel">
          <div className="panel-title">
            {entity === "you" ? "Style evidence — from your confirmed reads" : "Character"}
          </div>
          {entity === "you" ? (
            traits.reads + traits.skips > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                <Row k="Confirmed reads" v={`${traits.correct} of ${traits.reads} calls (${traits.hitRate}%)`} />
                <Row k="Sat out" v={`${traits.skips} positions`} />
                <Row k="Style read" v={leanLabel(traits)} />
                <Row k="Followed the run" v={`${traits.follows} confirmed`} />
                <Row k="Called the flip" v={`${traits.flips} confirmed`} />
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Only calls that matched the actual result count as style evidence.
                  Sit-outs are kept as a selectivity measure — a skipped unreadable
                  hand is the profile working, not a gap in it.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                No calibration evidence yet — run phase 2 to let the profiler watch
                how you actually read screens.
              </div>
            )
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {entity === "sniper"
                ? "Waits for alignment, then commits. Low call volume, sits out conflicted screens entirely. Use it as the discipline bar: on hands where Sniper is silent, ask yourself why you're not."
                : "Calls nearly everything readable and lands at the base rate. Use it as the floor: reads that can't beat Grinder aren't reads."}
            </div>
          )}
        </div>
      </div>

      <RecallScreens entity={entity} cfg={cfg} traits={traits} />

      {/* Side-by-side comparison */}
      <div className="panel mt-12">
        <div className="panel-title">Side-by-Side Comparison</div>
        <div className="profile-row" style={{ borderBottom: "1px solid var(--border-panel)", paddingBottom: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Metric</div>
          {ENTITIES.map(e => (
            <div key={e} style={{ fontSize: 11, color: ENTITY_COLOURS[e].correct, fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              {ENTITY_LABELS[e]}
            </div>
          ))}
        </div>
        {mockProfileStats.map((row, i) => (
          <div key={i} className="profile-row">
            <div className="profile-label">{row.label}</div>
            <div className="profile-you">{row.you}</div>
            <div className="profile-model" style={{ color: ENTITY_COLOURS.sniper.correct }}>{row.sniper}</div>
            <div className="profile-model" style={{ color: ENTITY_COLOURS.grinder.correct }}>{row.grinder}</div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          Placeholder numbers — real aggregates arrive once sessions persist in the backend pass.
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "var(--text-muted)" }}>{k}</span>
      <span style={{ color: "var(--gold)", fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
}

// Profile knobs, visually: conviction bar, road-alignment dots, lean chips.
function KnobsPanel({ cfg }: { cfg: ProfileConfig }) {
  const confPct = Math.round(((cfg.confidenceThreshold - 50) / 40) * 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
          Minimum conviction to call — <b style={{ color: "var(--gold)" }}>{cfg.confidenceThreshold}%</b>
        </div>
        <div className="conf-bar"><div className="conf-fill" style={{ width: `${Math.max(confPct, 4)}%` }} /></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <span style={{ color: "var(--text-muted)" }}>Derived roads aligned:</span>
        {[1, 2, 3].map(n => (
          <span key={n} style={{
            width: 14, height: 14, borderRadius: "50%",
            background: n <= cfg.minRoadsAligned ? "var(--gold)" : "transparent",
            border: "1.5px solid var(--border-panel)",
          }} />
        ))}
        <b style={{ color: "var(--gold)" }}>{cfg.minRoadsAligned === 0 ? "not required" : `${cfg.minRoadsAligned}+`}</b>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["streak", "chop", "adaptive"] as const).map(p => (
          <span key={p} style={{
            fontSize: 11, padding: "3px 10px", borderRadius: 999,
            border: `1px solid ${cfg.streakPref === p ? "var(--gold)" : "var(--border-panel)"}`,
            color: cfg.streakPref === p ? "var(--gold)" : "var(--text-muted)",
            background: cfg.streakPref === p ? "rgba(245,200,66,0.08)" : "transparent",
          }}>
            {p === "streak" ? "Follows streaks" : p === "chop" ? "Plays chops" : "Adaptive"}
          </span>
        ))}
        <span style={{
          fontSize: 11, padding: "3px 10px", borderRadius: 999,
          border: `1px solid ${cfg.sitOutOnConflict ? "var(--tie-green)" : "var(--border-panel)"}`,
          color: cfg.sitOutOnConflict ? "var(--tie-green)" : "var(--text-muted)",
        }}>
          {cfg.sitOutOnConflict ? "Sits out conflicts" : "Plays through conflicts"}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Min column depth before following a run: <b style={{ color: "var(--gold)" }}>{cfg.minColumnDepth}</b>
      </div>
    </div>
  );
}

// ── Recalled screens ──────────────────────────────────────────────────────
// The profile shown visually: actual board positions behind the numbers.
// For You these are the confirmed calibration reads; for the machines,
// positions on a recorded shoe where the engine's window opened.

interface Recall {
  key: string;
  title: string;
  sub: string;
  outcomes: Outcome[];
  upTo: number;
  ok: boolean;
}

function RecallScreens({ entity, cfg, traits }: {
  entity: EntityId; cfg: ProfileConfig; traits: ReturnType<typeof deriveTraits>;
}) {
  const [open, setOpen] = useState<string | null>(null);

  const recalls: Recall[] = useMemo(() => {
    if (entity === "you") {
      const cal = loadCalibration();
      return cal.answers
        .filter(a => a.correct === true)
        .slice(0, 6)
        .map(a => {
          const board = FOUNDATION_BOARDS.find(b => b.id === a.boardId)!;
          return {
            key: `${a.boardId}-${a.position}`,
            title: `${board.title} · game ${a.position + 1}`,
            sub: `You called ${a.guess === "banker" ? "Banker" : "Player"} — correct (${board.character.toLowerCase()})`,
            outcomes: board.outcomes,
            upTo: a.position,
            ok: true,
          };
        });
    }
    // Machines: engine reads on a recorded shoe where the window opened.
    const s = mockSessions[0];
    const outcomes = s.hands.map(h => h.outcome);
    const sigs = runSignals(outcomes, cfg);
    const windows = sigs
      .map((sig, i) => ({ sig, i }))
      .filter(x => x.sig && x.sig.window && outcomes[x.i] !== "tie");
    const picks = [windows[0], windows[Math.floor(windows.length / 2)], windows[windows.length - 1]]
      .filter((x, i, arr) => x && arr.findIndex(y => y && y.i === x.i) === i);
    return picks.map(x => {
      const sig = x!.sig!;
      const hit = sig.predictedSide === outcomes[x!.i];
      return {
        key: `m-${x!.i}`,
        title: `${s.venue} · game ${x!.i + 1}`,
        sub: `Called ${sig.predictedSide === "banker" ? "Banker" : "Player"} at ${sig.confidence}% conviction, ${sig.alignment} roads aligned — ${hit ? "hit" : "missed"}`,
        outcomes,
        upTo: x!.i,
        ok: hit,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, cfg, traits.correct]);

  return (
    <div className="panel">
      <div className="panel-title">Recalled screens — the profile, visually</div>
      {recalls.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          Nothing to recall yet — complete the calibration boards in phase 2 and your
          confirmed reads will appear here as the actual screens you read them on.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            Each entry is a real position behind this profile. Tap one to recall the
            screens exactly as they looked at the moment of the call.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recalls.map(r => (
              <div key={r.key}>
                <div
                  onClick={() => setOpen(o => (o === r.key ? null : r.key))}
                  style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    cursor: "pointer", padding: "8px 12px", borderRadius: "var(--radius-sm)",
                    background: "var(--bg-dark)",
                    border: `1px solid ${open === r.key ? "var(--border-accent)" : "var(--border-panel)"}`,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: r.ok ? "var(--tie-green)" : "var(--banker-red)" }}>{r.sub}</div>
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {open === r.key ? "▲ hide" : "▼ recall"}
                  </span>
                </div>
                {open === r.key && (
                  <div style={{ marginTop: 8, marginBottom: 4 }}>
                    <RoadsDisplay outcomes={r.outcomes.slice(0, r.upTo)} compact betsToggle={false} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
