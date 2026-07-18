import { Fragment, useEffect, useMemo, useState } from "react";
import type { Outcome } from "../../game/baccarat";
import { ENTITY_COLOURS, type EntityId } from "../../lib/entities";
import {
  toBeadPlate, toBigRoad, bigEyeBoy, smallRoad, cockroachPig,
  placeBigRoad, placeMarks, deriveRoadDetailed,
  type RoadMark, type PlacedCell, type BigRoadStone,
} from "../../game/roads";

// Extra elements of a hand beyond the outcome, displayed as markers on
// the Big Road and Bead Plate. Indexed in step with `outcomes`.
export interface HandExtra {
  natural?: boolean;
  bankerPair?: boolean;
  playerPair?: boolean;
  // sml-tiger | lge-tiger | sml-dragon | big-dragon | dragontiger-4/5/6
  variant?: string;
  // Total the hand tied on (6 = Tiger Tie, 7 = Dragon Tie)
  tieTotal?: number;
  // User's main-bet outcome on this hand: tile washes light (win) or dark (loss)
  betResult?: "win" | "loss";
}

// Tie-total badge: green disc with the tied total — gold ring for Tiger
// Tie (6-6), purple ring for Dragon Tie (7-7).
function TieTotalBadge({ total }: { total: number }) {
  if (total !== 6 && total !== 7) return null;
  return (
    <span className={`marker-tietotal ${total === 6 ? "tiger" : "dragon"}`}>
      {total}
    </span>
  );
}

interface Props {
  outcomes: Outcome[];
  extras?: (HandExtra | undefined)[];
  compact?: boolean;
  // Hide the bet-overlay toggle where betting doesn't apply (e.g. uploads)
  betsToggle?: boolean;
  // Label for the bet-overlay toggle (e.g. "Bets/Calls" in Practice)
  betsToggleLabel?: string;
  // When provided, the Bead Plate header gains an EDIT/Save button; in edit
  // mode clicking a bead cycles its result B → P → T via this callback, and
  // every derived road recomputes automatically.
  onCycleOutcome?: (handIdx: number) => void;
  // Prediction analysis overlay: fills Big Road tiles with the result colour
  // and draws per-entity arrow lines linking consecutive calls.
  analysisOverlay?: {
    entities: EntityId[];
    predictions: Record<EntityId, (Outcome | null)[]>;
    // Per-entity line-type visibility; absent = all shown
    filter?: Record<EntityId, { correct: boolean; wrong: boolean; nocall: boolean }>;
  };
}

// ── Markers (naturals, pairs, tigers, dragons) ──────────────────────────────
// Stencil-style Chinese dragon head, front-facing: a single-colour angular
// mask (swept horns, cheek spikes, slanted eye cutouts, nostrils, pointed
// chin). Purple family to stay in line with the Player-win blue:
// Small Dragon = purple; Big Dragon = dark purple.
export function DragonIcon({ size = 12, big = false }: { size?: number; big?: boolean }) {
  const colour = big ? "#5e2a8e" : "#a05ce0";
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32"
      style={{ display: "block" }}
      aria-label="dragon"
    >
      <path
        fillRule="evenodd"
        fill={colour}
        d="M16 5 L12 2 L11 7 L6 4 L8 10 L2 13 L8 14 L4 19 L10 18
           L9 25 L13 22 L16 30 L19 22 L23 25 L22 18 L28 19 L24 14
           L30 13 L24 10 L26 4 L21 7 L20 2 Z
           M10 13 L14 15 L13 17.5 L9 15.5 Z
           M22 13 L18 15 L19 17.5 L23 15.5 Z
           M14 21.5 L15.3 24 L12.8 24 Z
           M18 21.5 L16.7 24 L19.2 24 Z"
      />
    </svg>
  );
}

function VariantBadge({ variant }: { variant: string }) {
  if (variant === "sml-tiger" || variant === "lge-tiger") {
    return <span className={`marker-variant tiger ${variant === "lge-tiger" ? "big" : ""}`}>🐯</span>;
  }
  if (variant === "sml-dragon" || variant === "big-dragon") {
    const big = variant === "big-dragon";
    return (
      <span className={`marker-variant dragon ${big ? "big" : ""}`}>
        <DragonIcon size={big ? 17 : 13} big={big} />
      </span>
    );
  }
  if (variant.startsWith("dragontiger-")) {
    return <span className="marker-variant dragontiger">{variant.split("-")[1]}</span>;
  }
  return null;
}

function StoneMarkers({ extra }: { extra?: HandExtra }) {
  if (!extra) return null;
  return (
    <>
      {extra.natural && <span className="marker-natural">N</span>}
      {extra.playerPair && <span className="marker-pair player-pair" />}
      {extra.bankerPair && <span className="marker-pair banker-pair" />}
      {extra.variant && <VariantBadge variant={extra.variant} />}
      {extra.tieTotal !== undefined && <TieTotalBadge total={extra.tieTotal} />}
    </>
  );
}

const ROWS = 6;
const BIG_ROAD_MIN_COLS = 36;
const DERIVED_MIN_COLS = 36; // big eye / small road: 6 deep, 36 across
const BEAD_MIN_COLS = 18;

// ── Bead Plate ──────────────────────────────────────────────────────────────
// Populated top-to-bottom, left-to-right (column-major fill).
function BeadPlate({ outcomes, extras, cellSize, onCycle, selectedGame, onSelectGame }: {
  outcomes: Outcome[]; extras?: (HandExtra | undefined)[]; cellSize: number;
  onCycle?: (handIdx: number) => void;
  selectedGame?: number | null;
  onSelectGame?: (handIdx: number) => void;
}) {
  const cells = toBeadPlate(outcomes, ROWS);
  const cols = Math.max(Math.ceil(outcomes.length / ROWS), BEAD_MIN_COLS);

  return (
    <div
      className="road-grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
        width: cols * cellSize,
        minWidth: "100%",
      }}
    >
      {Array.from({ length: ROWS * cols }).map((_, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const handIdx = col * ROWS + row;
        const cell = cells.find(c => c.col === col && c.row === row);
        const betResult = cell ? extras?.[handIdx]?.betResult : undefined;
        const selected = cell && selectedGame === handIdx;
        const clickable = cell && (onCycle || onSelectGame);
        return (
          <div
            key={idx}
            className={`road-cell${betResult ? ` bet-${betResult}` : ""}${selected ? " tile-selected" : ""}`}
            style={clickable ? { cursor: "pointer" } : undefined}
            title={cell ? (onCycle ? `Hand ${handIdx + 1} — click to change` : `Game ${handIdx + 1}`) : undefined}
            onClick={cell ? () => (onCycle ? onCycle(handIdx) : onSelectGame?.(handIdx)) : undefined}
          >
            {cell && (
              <>
                <div
                  className={`road-stone ${cell.outcome}`}
                  style={{ width: cellSize * 0.72, height: cellSize * 0.72 }}
                >
                  {cell.outcome === "banker" ? "B" : cell.outcome === "player" ? "P" : "T"}
                </div>
                <StoneMarkers extra={extras?.[handIdx]} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Big Road ─────────────────────────────────────────────────────────────────
function BigRoad({ outcomes, extras, cellSize, analysisOverlay, selectedGame, onSelectGame }: {
  outcomes: Outcome[]; extras?: (HandExtra | undefined)[]; cellSize: number;
  analysisOverlay?: Props["analysisOverlay"];
  selectedGame?: number | null;
  onSelectGame?: (handIdx: number) => void;
}) {
  const stones = toBigRoad(outcomes);
  // Stones drop ties, so stone i corresponds to the i-th non-tie hand.
  const stoneExtra = new Map<BigRoadStone, HandExtra | undefined>();
  const stoneGame = new Map<BigRoadStone, number>();
  {
    let si = 0;
    outcomes.forEach((o, handIdx) => {
      if (o !== "tie") stoneGame.set(stones[si++], handIdx);
    });
  }
  if (extras) {
    let stoneIdx = 0;
    outcomes.forEach((o, handIdx) => {
      if (o !== "tie") {
        stoneExtra.set(stones[stoneIdx++], extras[handIdx]);
      } else {
        // Ties ride on the previous stone — carry the tie total (Tiger/
        // Dragon Tie badge) across to it. First badge wins if several tie.
        const t = extras[handIdx]?.tieTotal;
        const carrier = stones[stoneIdx - 1];
        if (t !== undefined && carrier) {
          const existing = stoneExtra.get(carrier);
          if (existing?.tieTotal === undefined) {
            stoneExtra.set(carrier, { ...existing, tieTotal: t });
          }
        }
      }
    });
  }
  const placed = placeBigRoad(stones, ROWS);
  const maxCol = placed.length ? Math.max(...placed.map(p => p.col)) + 1 : 0;
  const cols = Math.max(maxCol, BIG_ROAD_MIN_COLS);

  const byPos = new Map<string, PlacedCell<BigRoadStone>>();
  for (const p of placed) byPos.set(`${p.col},${p.row}`, p);

  // Analysis overlay geometry: map each game to its stone's cell centre
  // (ties ride on the previous stone's cell).
  const stonePos = new Map<BigRoadStone, { col: number; row: number }>();
  for (const p of placed) stonePos.set(p.value, { col: p.col, row: p.row });
  const gameCentre: ({ x: number; y: number } | null)[] = [];
  {
    let stoneIdx = 0;
    outcomes.forEach(o => {
      const stone = o !== "tie" ? stones[stoneIdx++] : stones[stoneIdx - 1];
      const pos = stone ? stonePos.get(stone) : undefined;
      gameCentre.push(pos ? { x: pos.col * cellSize + cellSize / 2, y: pos.row * cellSize + cellSize / 2 } : null);
    });
  }
  const entityOffset: Record<EntityId, number> = { you: -6, sniper: 0, grinder: 6 };

  return (
    <div style={{ position: "relative", width: cols * cellSize, minWidth: "100%" }}>
    <div
      className="road-grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
        width: cols * cellSize,
        minWidth: "100%",
      }}
    >
      {Array.from({ length: ROWS * cols }).map((_, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const p = byPos.get(`${col},${row}`);
        const betResult = p ? stoneExtra.get(p.value)?.betResult : undefined;
        const game = p ? stoneGame.get(p.value) : undefined;
        const selected = game !== undefined && game === selectedGame;
        const sideColour = p ? (p.value.side === "banker" ? "var(--banker-red)" : "var(--player-blue)") : undefined;
        // Selected tile turns white (overriding any overlay fill); otherwise
        // the analysis overlay fills the tile with the result colour.
        const bg = selected ? "#ffffff" : (analysisOverlay && p ? sideColour : undefined);
        // Ring border: coloured on a white/plain tile so it reads; white-ish
        // only on a colour-filled overlay tile.
        const ringBorder = analysisOverlay && !selected ? "rgba(255,255,255,0.55)" : undefined;
        return (
          <div
            key={idx}
            className={`road-cell${betResult ? ` bet-${betResult}` : ""}${selected ? " tile-selected" : ""}`}
            style={{ ...(bg ? { background: bg } : {}), ...(p && onSelectGame ? { cursor: "pointer" } : {}) }}
            title={p && game !== undefined ? `Game ${game + 1}` : undefined}
            onClick={p && game !== undefined && onSelectGame ? () => onSelectGame(game) : undefined}
          >
            {p && (
              <>
                <div
                  className={`road-stone big-road-${p.value.side}`}
                  style={{
                    width: cellSize * 0.72, height: cellSize * 0.72,
                    ...(ringBorder ? { borderColor: ringBorder } : {}),
                  }}
                />
                {/* One slash per tie, offset within the tile; 5+ consecutive
                    ties fill the tile solid green (more lines add nothing) */}
                {p.value.ties >= 5 ? (
                  // Solid green fills the inside of the stone only — the
                  // banker/player ring stays visible around it
                  <div
                    className="tie-solid"
                    style={{ width: cellSize * 0.5, height: cellSize * 0.5 }}
                  />
                ) : (
                  Array.from({ length: Math.min(p.value.ties, 4) }).map((_, i) => (
                    <div key={i} className={`tie-slash tie-pos-${i}`} />
                  ))
                )}
                <StoneMarkers extra={stoneExtra.get(p.value)} />
              </>
            )}
          </div>
        );
      })}
    </div>

    {/* Prediction arrows: link each entity's consecutive calls */}
    {analysisOverlay && (
      <svg
        width={cols * cellSize}
        height={ROWS * cellSize}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {analysisOverlay.entities.map(e => {
          const preds = analysisOverlay.predictions[e];
          // Selective entities (You, Sniper) also show the games they sat
          // out as thin dashed grey bridges; Grinder bets nearly every game.
          const showSkips = e !== "grinder";
          const off = entityOffset[e];
          const f = analysisOverlay.filter?.[e];

          // Ordered points (games with a Big-Road cell). Ties push (kind
          // inherits the surrounding streak); skips are sit-outs.
          type Kind = "correct" | "wrong" | "push" | "skip";
          const pts: { x: number; y: number; kind: Kind }[] = [];
          outcomes.forEach((o, i) => {
            const pos = gameCentre[i];
            if (!pos) return;
            if (!preds[i]) { if (showSkips) pts.push({ x: pos.x + off, y: pos.y + off, kind: "skip" }); return; }
            const kind: Kind = o === "tie" ? "push" : preds[i] === o ? "correct" : "wrong";
            pts.push({ x: pos.x + off, y: pos.y + off, kind });
          });

          // Effective kind for each point — pushes inherit the nearest
          // decisive (correct/wrong) call so a streak reads through a tie.
          const ek: ("correct" | "wrong" | "skip")[] = pts.map(p => {
            if (p.kind === "skip") return "skip";
            return p.kind === "push" ? "correct" : p.kind;
          });
          pts.forEach((p, i) => {
            if (p.kind !== "push") return;
            let k: "correct" | "wrong" | null = null;
            for (let j = i - 1; j >= 0 && !k; j--) if (pts[j].kind === "correct" || pts[j].kind === "wrong") k = pts[j].kind as "correct" | "wrong";
            for (let j = i + 1; j < pts.length && !k; j++) if (pts[j].kind === "correct" || pts[j].kind === "wrong") k = pts[j].kind as "correct" | "wrong";
            ek[i] = k ?? "correct";
          });

          // Routing: straight down within a column; across a column change
          // run to the target column's border, up (or down) that border,
          // then in — so vertical runs sit on the tile border, never
          // cutting across tile faces. Diagonals never occur.
          const route = (a: { x: number; y: number }, b: { x: number; y: number }) => {
            if (Math.abs(a.x - b.x) < 0.5) return `M ${a.x} ${a.y} V ${b.y}`;
            const borderX = b.x - (cellSize / 2) * Math.sign(b.x - a.x);
            return `M ${a.x} ${a.y} H ${borderX} V ${b.y} H ${b.x}`;
          };

          const elems: React.ReactNode[] = [];
          const NOCALL = "rgba(190,205,210,0.8)"; // no-call / still-forming
          const w = 5, h = 7;

          // Runs: maximal stretches of the same state — a win streak, a loss
          // streak, or a no-call (sit-out) streak. Each run is one continuous
          // line ending in an arrowhead; no line crosses a state change, so a
          // tile never carries two colours. No-call runs are dashed grey and
          // treated exactly like correct/incorrect runs.
          let i = 0;
          while (i < pts.length) {
            const skipRun = pts[i].kind === "skip";
            const kind: "correct" | "wrong" = ek[i] === "wrong" ? "wrong" : "correct";
            let end = i;
            if (skipRun) {
              while (end + 1 < pts.length && pts[end + 1].kind === "skip") end++;
            } else {
              while (end + 1 < pts.length && pts[end + 1].kind !== "skip" && ek[end + 1] === ek[i]) end++;
            }
            // Skip this run entirely if its type is filtered off for e
            const ftype = skipRun ? "nocall" : kind;
            if (f && !f[ftype]) { i = end + 1; continue; }

            const colour = skipRun ? NOCALL : ENTITY_COLOURS[e][kind];
            const dash = skipRun ? "3 4" : undefined;
            const runWidth = (pos: number) =>
              skipRun ? 1.6 : kind === "correct" ? Math.min(2 + pos * 0.9, 6) : 2;

            // Continuous line through the run
            for (let k = i + 1; k <= end; k++) {
              elems.push(
                <path key={`${e}-${k}`} d={route(pts[k - 1], pts[k])} fill="none"
                  stroke={colour} strokeWidth={runWidth(k - i)} opacity={skipRun ? 0.8 : 0.92}
                  strokeDasharray={dash} strokeLinejoin="round" strokeLinecap="round" />,
              );
            }

            // Arrowhead at the run's last tile, tip touching its bottom edge
            const b = pts[end];
            const bottomY = b.y - off + cellSize / 2;
            elems.push(
              <path key={`${e}-stub-${end}`}
                d={`M ${b.x} ${b.y} V ${bottomY - h + 1}`}
                fill="none" stroke={colour} strokeWidth={runWidth(end - i)}
                strokeDasharray={dash} strokeLinecap="round" opacity={skipRun ? 0.8 : 0.92} />,
            );
            elems.push(
              <path key={`${e}-head-${end}`}
                d={`M ${b.x - w} ${bottomY - h} L ${b.x + w} ${bottomY - h} L ${b.x} ${bottomY} Z`}
                fill={colour} opacity={skipRun ? 0.85 : 0.95} />,
            );

            i = end + 1;
          }
          return elems;
        })}
      </svg>
    )}
    </div>
  );
}

// ── Derived roads ────────────────────────────────────────────────────────────
// Marks are placed exactly like Big Road stones: same colour stacks downward,
// a colour change starts a new column, deep runs dragon-tail to the right.
// Big Eye Road: hollow circles ("donuts") · Small Road: solid circles ·
// Cockroach: diagonal slashes.
type MarkStyle = "donut" | "solid" | "slash";

function PlacedRoadGrid({
  placed, cellSize, markStyle, cols, cellGame, selectedGame,
}: {
  placed: PlacedCell<RoadMark>[]; cellSize: number; markStyle: MarkStyle; cols: number;
  cellGame?: Map<string, number>; selectedGame?: number | null;
}) {
  const byPos = new Map<string, RoadMark>();
  for (const p of placed) byPos.set(`${p.col},${p.row}`, p.value);

  return (
    <div
      className="road-grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
        width: cols * cellSize,
        minWidth: "100%",
      }}
    >
      {Array.from({ length: ROWS * cols }).map((_, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const key = `${col},${row}`;
        const mark = byPos.get(key);
        const selected = selectedGame != null && cellGame?.get(key) === selectedGame;
        const size = cellSize * (markStyle === "slash" ? 0.8 : 0.66);
        return (
          <div key={idx} className={`road-cell${selected ? " tile-selected" : ""}`}>
            {mark && (
              markStyle === "slash" ? (
                <div className={`mark-slash ${mark}`} style={{ width: size, height: size }} />
              ) : (
                <div className={`mark-circle ${markStyle} ${mark}`} style={{ width: size, height: size }} />
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

function DerivedRoad({
  marks, markGames, cellSize, markStyle, minCols = DERIVED_MIN_COLS, selectedGame,
}: {
  marks: RoadMark[]; markGames?: number[]; cellSize: number; markStyle: MarkStyle;
  minCols?: number; selectedGame?: number | null;
}) {
  const placed = placeMarks(marks, ROWS);
  const maxCol = placed.length ? Math.max(...placed.map(p => p.col)) + 1 : 0;
  const cols = Math.max(maxCol, minCols);
  // placeMarks preserves input order, so placed[k] ↔ markGames[k]
  const cellGame = new Map<string, number>();
  if (markGames) placed.forEach((p, k) => cellGame.set(`${p.col},${p.row}`, markGames[k]));
  return <PlacedRoadGrid placed={placed} cellSize={cellSize} markStyle={markStyle} cols={cols}
    cellGame={cellGame} selectedGame={selectedGame} />;
}

// Cockroach Road — two stacked bands. Sticks travel left to right; when the
// top band runs out of columns the marks continue on the bottom band
// (matches casino display behaviour).
function CockroachBands({
  marks, markGames, cellSize, bandCols, selectedGame,
}: {
  marks: RoadMark[]; markGames?: number[]; cellSize: number; bandCols: number;
  selectedGame?: number | null;
}) {
  const placed = placeMarks(marks, ROWS);
  const gameOf = new Map<string, number>();
  if (markGames) placed.forEach((p, k) => gameOf.set(`${p.col},${p.row}`, markGames[k]));

  const topCells = placed.filter(p => p.col < bandCols);
  const bottomCells = placed.filter(p => p.col >= bandCols).map(p => ({ ...p, col: p.col - bandCols }));

  const topGame = new Map<string, number>();
  topCells.forEach(p => { const g = gameOf.get(`${p.col},${p.row}`); if (g !== undefined) topGame.set(`${p.col},${p.row}`, g); });
  const bottomGame = new Map<string, number>();
  placed.filter(p => p.col >= bandCols).forEach(p => {
    const g = gameOf.get(`${p.col},${p.row}`);
    if (g !== undefined) bottomGame.set(`${p.col - bandCols},${p.row}`, g);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <PlacedRoadGrid placed={topCells} cellSize={cellSize} markStyle="slash" cols={bandCols}
        cellGame={topGame} selectedGame={selectedGame} />
      <PlacedRoadGrid placed={bottomCells} cellSize={cellSize} markStyle="slash" cols={bandCols}
        cellGame={bottomGame} selectedGame={selectedGame} />
    </div>
  );
}

// ── Header stats (Game / Banker / Player / Tie with eye toggle) ─────────────
function HeaderStats({ outcomes }: { outcomes: Outcome[] }) {
  const [visible, setVisible] = useState(true);
  const banker = outcomes.filter(o => o === "banker").length;
  const player = outcomes.filter(o => o === "player").length;
  const tie = outcomes.filter(o => o === "tie").length;
  return (
    <span className="header-stats">
      <span style={{ display: "flex", gap: 14, visibility: visible ? "visible" : "hidden" }}>
        <span className="header-stat"><span className="header-stat-label">Game</span> <span className="stats-value games" style={{ fontSize: 13 }}>{outcomes.length}</span></span>
        <span className="header-stat"><span className="header-stat-label">Banker</span> <span className="stats-value banker" style={{ fontSize: 13 }}>{banker}</span></span>
        <span className="header-stat"><span className="header-stat-label">Player</span> <span className="stats-value player" style={{ fontSize: 13 }}>{player}</span></span>
        <span className="header-stat"><span className="header-stat-label">Tie</span> <span className="stats-value tie" style={{ fontSize: 13 }}>{tie}</span></span>
      </span>
      <button
        className="eye-toggle"
        title={visible ? "Hide stats" : "Show stats"}
        onClick={() => setVisible(v => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
          {!visible && <line x1="3" y1="21" x2="21" y2="3" />}
        </svg>
      </button>
    </span>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function RoadSection({
  titleCn, titleEn, children, style, align = "center", headerExtra, selectionKey,
}: {
  titleCn: string; titleEn: string; children: React.ReactNode;
  style?: React.CSSProperties; align?: "left" | "center";
  headerExtra?: React.ReactNode; selectionKey?: React.ReactNode;
}) {
  return (
    <div className="road-section" style={style}>
      <div className={`road-section-header ${align === "left" || headerExtra ? "align-left" : "align-center"}`}>
        <span className={headerExtra ? "road-title-block" : undefined} style={headerExtra ? undefined : { display: "contents" }}>
          <span className="road-section-title-en">{titleEn}</span>
          <span className="road-section-title-sep">/</span>
          <span className="road-section-title-cn">{titleCn}</span>
        </span>
        {headerExtra && <span className="header-extra">{headerExtra}</span>}
        {selectionKey && <span className="road-sel-key">{selectionKey}</span>}
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

// Small key shown in a road header when a game is highlighted across screens.
// The white square doubles as a clickable × to clear the highlight.
function SelectionKey({ game, onClear }: { game: number; onClear: () => void }) {
  return (
    <span className="selection-key">
      <button className="sel-square" onClick={onClear} title="Clear highlight">×</button>
      Game {game + 1}
    </span>
  );
}

// ── Stats panel (bottom-right, casino style) ─────────────────────────────────
function StatsPanel({ outcomes }: { outcomes: Outcome[] }) {
  const banker = outcomes.filter(o => o === "banker").length;
  const player = outcomes.filter(o => o === "player").length;
  const tie = outcomes.filter(o => o === "tie").length;

  return (
    <div className="stats-panel">
      <div className="stats-row"><span className="stats-label">局数 Games</span><span className="stats-value games">{outcomes.length}</span></div>
      <div className="stats-row"><span className="stats-label"><span className="stats-dot banker-dot">庄</span>Banker</span><span className="stats-value banker">{banker}</span></div>
      <div className="stats-row"><span className="stats-label"><span className="stats-dot player-dot">闲</span>Player</span><span className="stats-value player">{player}</span></div>
      <div className="stats-row"><span className="stats-label"><span className="stats-dot tie-dot">和</span>Tie</span><span className="stats-value tie">{tie}</span></div>
    </div>
  );
}

// Exotic side-bet counters, stacked vertically beside the predictor table.
function SideBetCounts({ extras }: { extras?: (HandExtra | undefined)[] }) {
  const count = (pred: (e: HandExtra) => boolean) =>
    (extras ?? []).filter((e): e is HandExtra => !!e && pred(e)).length;
  return (
    <div className="side-bet-list">
      <span className="stats-side-item"><b className="marker-natural inline">N</b> Natural <b>{count(e => !!e.natural)}</b></span>
      <span className="stats-side-item"><span className="marker-pair banker-pair inline" /> B Pair <b>{count(e => !!e.bankerPair)}</b></span>
      <span className="stats-side-item"><span className="marker-pair player-pair inline" /> P Pair <b>{count(e => !!e.playerPair)}</b></span>
      <span className="stats-side-item">🐯 Tiger <b>{count(e => e.variant === "sml-tiger" || e.variant === "lge-tiger")}</b></span>
      <span className="stats-side-item"><DragonIcon size={14} /> Dragon <b>{count(e => e.variant === "sml-dragon" || e.variant === "big-dragon")}</b></span>
      <span className="stats-side-item"><span className="marker-variant dragontiger inline" style={{ width: 13, height: 13 }}>#</span> D-Tiger <b>{count(e => !!e.variant?.startsWith("dragontiger-"))}</b></span>
    </div>
  );
}

// ── Key / legend popup ───────────────────────────────────────────────────────
function LegendKey() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="legend-key-btn" title="Symbol key" onClick={() => setOpen(true)}>
        🔑 Key
      </button>
      {open && (
        <div className="info-overlay" onClick={() => setOpen(false)}>
          <div className="info-popup" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Symbol Key</div>
              <button className="info-close" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="legend-list">
              <div className="legend-row"><span className="road-stone big-road-banker" style={{ width: 20, height: 20 }} /> Banker win</div>
              <div className="legend-row"><span className="road-stone big-road-player" style={{ width: 20, height: 20 }} /> Player win</div>
              <div className="legend-row">
                <span style={{ position: "relative", width: 20, height: 20, display: "inline-block" }}>
                  <span className="road-stone big-road-banker" style={{ width: 20, height: 20, display: "block" }} />
                  <span className="tie-slash tie-pos-0" />
                </span>
                Tie — one slash per tie; consecutive ties stack at offsets
              </div>
              <div className="legend-row"><b className="marker-natural inline">N</b> Natural win (8/9 on two cards)</div>
              <div className="legend-row">
                <span style={{ position: "relative", width: 20, height: 20, display: "inline-block", flexShrink: 0 }}>
                  <span className="road-stone big-road-player" style={{ width: 20, height: 20, display: "block" }} />
                  <span className="marker-pair player-pair" />
                </span>
                Player pair — dot on the top-right of the circle
              </div>
              <div className="legend-row">
                <span style={{ position: "relative", width: 20, height: 20, display: "inline-block", flexShrink: 0 }}>
                  <span className="road-stone big-road-banker" style={{ width: 20, height: 20, display: "block" }} />
                  <span className="marker-pair banker-pair" />
                </span>
                Banker pair — dot on the bottom-left of the circle
              </div>
              <div className="legend-row"><span className="marker-variant tiger inline" style={{ fontSize: 12 }}>🐯</span> Small Tiger — Banker wins on 6 with two cards</div>
              <div className="legend-row"><span className="marker-variant tiger inline" style={{ fontSize: 16 }}>🐯</span> Big Tiger — Banker wins on 6 with three cards</div>
              <div className="legend-row"><span className="marker-variant dragon inline"><DragonIcon size={14} /></span> Small Dragon — Player wins 7 v Banker ≤5 (two cards)</div>
              <div className="legend-row"><span className="marker-variant dragon inline"><DragonIcon size={18} big /></span> Big Dragon — Player wins 7 v Banker ≤5 (three cards)</div>
              <div className="legend-row"><span className="marker-variant dragontiger inline">4</span> Dragon Tiger — Player 7 beats Banker 6; number shows total cards dealt (4, 5 or 6; Dragon bets also pay)</div>
              <div className="legend-row"><span className="marker-tietotal tiger inline">6</span> Tiger Tie — hand ties with both totals 6</div>
              <div className="legend-row"><span className="marker-tietotal dragon inline">7</span> Dragon Tie — hand ties with both totals 7</div>
              <div className="legend-row"><span className="legend-cell bet-win" /> Light tile — your Banker/Player bet won this hand</div>
              <div className="legend-row"><span className="legend-cell bet-loss" /> Dark tile — your Banker/Player bet lost this hand</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Predictor table ("ask the road" 问路) ────────────────────────────────────
// Standard casino inclusion: shows the mark each derived road would print
// if the next hand lands Banker (庄) or Player (闲).
function nextMark(
  outcomes: Outcome[],
  side: "banker" | "player",
  road: (stones: BigRoadStone[]) => RoadMark[],
): RoadMark | null {
  const current = road(toBigRoad(outcomes));
  const next = road(toBigRoad([...outcomes, side]));
  return next.length > current.length ? next[next.length - 1] : null;
}

function PredictorCell({ mark, style }: { mark: RoadMark | null; style: MarkStyle }) {
  const size = 22;
  return (
    <div className="predictor-cell">
      {mark && (
        style === "slash" ? (
          <div className={`mark-slash ${mark}`} style={{ width: size, height: size }} />
        ) : (
          <div className={`mark-circle ${style} ${mark}`} style={{ width: size, height: size }} />
        )
      )}
    </div>
  );
}

function PredictorTable({ outcomes, selectedGame, onClearSelection }: {
  outcomes: Outcome[];
  /** Highlighted game index. While set, the table asks the road as if the
   *  shoe had been played only up to the white tile — the reads for the hand
   *  right after it. Cleared (or a new hand recorded) → back to the live end
   *  of the shoe. */
  selectedGame?: number | null;
  onClearSelection?: () => void;
}) {
  const rewound = selectedGame != null;
  const upTo = rewound ? outcomes.slice(0, selectedGame + 1) : outcomes;
  const roads: { road: (s: BigRoadStone[]) => RoadMark[]; style: MarkStyle }[] = [
    { road: bigEyeBoy,    style: "donut" },
    { road: smallRoad,    style: "solid" },
    { road: cockroachPig, style: "slash" },
  ];
  return (
    // The table keeps its fixed position (CSS margin-top aligns it with the
    // Games stat row); the highlight chip is absolutely positioned so it
    // floats above the table without shifting it. It reads as a rectangular
    // box whose bottom edge sits on the predictor's top edge (shared line),
    // clearing the Cockroach box above.
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignSelf: "flex-start" }}>
      {rewound && (
        <button
          className="selection-key"
          onClick={onClearSelection}
          title="Clear highlight — return to the live shoe position"
          style={{
            position: "absolute", left: 0, right: 0, top: 18, transform: "translateY(-100%)", zIndex: 2,
            boxSizing: "border-box", justifyContent: "center",
            background: "var(--bg-panel)", cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.6)", borderBottom: "none",
            borderRadius: "3px 3px 0 0", padding: "3px 12px", whiteSpace: "nowrap",
          }}
        >
          <span className="sel-square">×</span> Game {selectedGame + 1}
        </button>
      )}
      <div className="predictor-table">
        <div className="predictor-header banker">
          <span className="predictor-header-cn">庄</span>
          <span className="predictor-header-en">Banker</span>
        </div>
        <div className="predictor-header player">
          <span className="predictor-header-cn">闲</span>
          <span className="predictor-header-en">Player</span>
        </div>
        {roads.map(({ road, style }, i) => (
          <Fragment key={i}>
            <PredictorCell mark={nextMark(upTo, "banker", road)} style={style} />
            <PredictorCell mark={nextMark(upTo, "player", road)} style={style} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Main export — casino screen layout ───────────────────────────────────────
export default function RoadsDisplay({
  outcomes, extras, compact = false, betsToggle = true, betsToggleLabel = "Bets", onCycleOutcome, analysisOverlay,
}: Props) {
  // View mode for Big Road + Bead Plate markers:
  // basic = outcomes, ties and naturals only · detailed = + pairs and exotics
  const [viewMode, setViewMode] = useState<"basic" | "detailed">("detailed");
  const [showBetOverlay, setShowBetOverlay] = useState(true);
  const [editingBeads, setEditingBeads] = useState(false);
  const shownExtras = extras?.map(e => {
    if (!e) return e;
    const base = viewMode === "detailed"
      ? { ...e }
      : { natural: e.natural, betResult: e.betResult } as HandExtra;
    if (!showBetOverlay) delete base.betResult;
    return base;
  });
  const stones = useMemo(() => toBigRoad(outcomes), [outcomes]);

  // Cross-road tile highlight: tap a Big Road / Bead Plate tile to light up
  // every screen's cell for that game. Reset when the shoe changes.
  const [selectedGame, setSelectedGame] = useState<number | null>(null);
  const outcomesKey = outcomes.join("|");
  useEffect(() => { setSelectedGame(null); }, [outcomesKey]);
  const selectGame = (g: number) => setSelectedGame(prev => (prev === g ? null : g));

  // Stone index → game index (stones drop ties)
  const stoneToGame = useMemo(() => {
    const arr: number[] = [];
    let si = 0;
    outcomes.forEach((o, gi) => { if (o !== "tie") arr[si++] = gi; });
    return arr;
  }, [outcomes]);

  // Derived roads with per-mark game mapping
  const bebDet = useMemo(() => deriveRoadDetailed(stones, 1), [stones]);
  const srDet  = useMemo(() => deriveRoadDetailed(stones, 2), [stones]);
  const cpDet  = useMemo(() => deriveRoadDetailed(stones, 3), [stones]);
  const beb = bebDet.map(d => d.mark);
  const sr  = srDet.map(d => d.mark);
  const cp  = cpDet.map(d => d.mark);
  const bebGames = bebDet.map(d => stoneToGame[d.stoneIndex]);
  const srGames  = srDet.map(d => stoneToGame[d.stoneIndex]);
  const cpGames  = cpDet.map(d => stoneToGame[d.stoneIndex]);

  // Which roads contain the selected game (drives the header key)
  const hasSel = selectedGame != null && selectedGame < outcomes.length;
  const beadHasSel = hasSel;
  const bigRoadHasSel = hasSel && outcomes[selectedGame!] !== "tie";
  const bebHasSel = hasSel && bebGames.includes(selectedGame!);
  const srHasSel  = hasSel && srGames.includes(selectedGame!);
  const cpHasSel  = hasSel && cpGames.includes(selectedGame!);
  const selKey = (show: boolean) => (show && selectedGame != null
    ? <SelectionKey game={selectedGame} onClear={() => setSelectedGame(null)} />
    : undefined);

  const bigCell   = compact ? 20 : 26;
  const smallCell = compact ? 11 : 13;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Row 1 — Big Road full width */}
      <RoadSection titleCn="大路" titleEn="Big Road" align="left"
        headerExtra={
          <>
            <HeaderStats outcomes={outcomes} />
            <span className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === "basic" ? "active" : ""}`}
                onClick={() => setViewMode("basic")}
              >
                Basic
              </button>
              <button
                className={`view-toggle-btn ${viewMode === "detailed" ? "active" : ""}`}
                onClick={() => setViewMode("detailed")}
              >
                Detailed
              </button>
            </span>
            {betsToggle && (
              <span className="view-toggle" style={{ marginLeft: 20 }}>
                <button
                  className={`view-toggle-btn ${showBetOverlay ? "active" : ""}`}
                  title="Show/hide your bet results on the tiles"
                  onClick={() => setShowBetOverlay(p => !p)}
                >
                  {betsToggleLabel}
                </button>
              </span>
            )}
            <LegendKey />
          </>
        }
        selectionKey={selKey(bigRoadHasSel)}>
        <BigRoad outcomes={outcomes} extras={shownExtras} cellSize={bigCell} analysisOverlay={analysisOverlay}
          selectedGame={selectedGame} onSelectGame={selectGame} />
      </RoadSection>

      {/* Row 2 — left: Big Eye above Small Road · right: Cockroach two bands */}
      <div className="roads-mid-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <RoadSection titleCn="大眼仔" titleEn="Big Eye Boy" selectionKey={selKey(bebHasSel)}>
            <DerivedRoad marks={beb} markGames={bebGames} cellSize={smallCell} markStyle="donut" selectedGame={selectedGame} />
          </RoadSection>
          <RoadSection titleCn="小路" titleEn="Small Road" selectionKey={selKey(srHasSel)}>
            <DerivedRoad marks={sr} markGames={srGames} cellSize={smallCell} markStyle="solid" selectedGame={selectedGame} />
          </RoadSection>
        </div>
        <RoadSection titleCn="曱甴路" titleEn="Cockroach Road" selectionKey={selKey(cpHasSel)}>
          <CockroachBands marks={cp} markGames={cpGames} cellSize={smallCell} bandCols={DERIVED_MIN_COLS} selectedGame={selectedGame} />
        </RoadSection>
      </div>

      {/* Row 3 — Bead Plate left · stats panel right */}
      <div className="roads-bottom-grid">
        <RoadSection titleCn="珠盘路" titleEn="Bead Plate"
          headerExtra={
            <>
              <HeaderStats outcomes={outcomes} />
              {onCycleOutcome && (
                <button
                  className="bead-edit-btn"
                  data-editing={editingBeads || undefined}
                  onClick={() => setEditingBeads(p => !p)}
                >
                  {editingBeads ? "💾 Save" : "✎ EDIT"}
                </button>
              )}
            </>
          }
          selectionKey={selKey(beadHasSel)}>
          <BeadPlate
            outcomes={outcomes}
            extras={shownExtras}
            cellSize={bigCell}
            onCycle={editingBeads ? onCycleOutcome : undefined}
            selectedGame={selectedGame}
            onSelectGame={editingBeads ? undefined : selectGame}
          />
        </RoadSection>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <StatsPanel outcomes={outcomes} />
          <PredictorTable
            outcomes={outcomes}
            selectedGame={hasSel ? selectedGame : null}
            onClearSelection={() => setSelectedGame(null)}
          />
          <SideBetCounts extras={extras} />
        </div>
      </div>
    </div>
  );
}
