import { Fragment, useMemo, useState } from "react";
import type { Outcome } from "../../game/baccarat";
import {
  toBeadPlate, toBigRoad, bigEyeBoy, smallRoad, cockroachPig,
  placeBigRoad, placeMarks,
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
}

interface Props {
  outcomes: Outcome[];
  extras?: (HandExtra | undefined)[];
  compact?: boolean;
}

// ── Markers (naturals, pairs, tigers, dragons) ──────────────────────────────
// Stencil-style Chinese dragon head, front-facing: a single-colour angular
// mask (swept horns, cheek spikes, slanted eye cutouts, nostrils, pointed
// chin). Small Dragon = jade green; Big Dragon = gold.
export function DragonIcon({ size = 12, big = false }: { size?: number; big?: boolean }) {
  const colour = big ? "var(--gold, #f5c842)" : "#1fa05a";
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
    </>
  );
}

const ROWS = 6;
const BIG_ROAD_MIN_COLS = 36;
const DERIVED_MIN_COLS = 36; // big eye / small road: 6 deep, 36 across
const BEAD_MIN_COLS = 18;

// ── Bead Plate ──────────────────────────────────────────────────────────────
// Populated top-to-bottom, left-to-right (column-major fill).
function BeadPlate({ outcomes, extras, cellSize }: { outcomes: Outcome[]; extras?: (HandExtra | undefined)[]; cellSize: number }) {
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
        return (
          <div key={idx} className="road-cell">
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
function BigRoad({ outcomes, extras, cellSize }: { outcomes: Outcome[]; extras?: (HandExtra | undefined)[]; cellSize: number }) {
  const stones = toBigRoad(outcomes);
  // Stones drop ties, so stone i corresponds to the i-th non-tie hand.
  const stoneExtra = new Map<BigRoadStone, HandExtra | undefined>();
  if (extras) {
    let stoneIdx = 0;
    outcomes.forEach((o, handIdx) => {
      if (o !== "tie") stoneExtra.set(stones[stoneIdx++], extras[handIdx]);
    });
  }
  const placed = placeBigRoad(stones, ROWS);
  const maxCol = placed.length ? Math.max(...placed.map(p => p.col)) + 1 : 0;
  const cols = Math.max(maxCol, BIG_ROAD_MIN_COLS);

  const byPos = new Map<string, PlacedCell<BigRoadStone>>();
  for (const p of placed) byPos.set(`${p.col},${p.row}`, p);

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
        const p = byPos.get(`${col},${row}`);
        return (
          <div key={idx} className="road-cell">
            {p && (
              <>
                <div
                  className={`road-stone big-road-${p.value.side}`}
                  style={{ width: cellSize * 0.72, height: cellSize * 0.72 }}
                />
                {/* One slash per tie (up to 3), offset so consecutive ties are visible */}
                {Array.from({ length: Math.min(p.value.ties, 3) }).map((_, i) => (
                  <div key={i} className={`tie-slash tie-pos-${i}`} />
                ))}
                <StoneMarkers extra={stoneExtra.get(p.value)} />
              </>
            )}
          </div>
        );
      })}
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
  placed, cellSize, markStyle, cols,
}: { placed: PlacedCell<RoadMark>[]; cellSize: number; markStyle: MarkStyle; cols: number }) {
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
        const mark = byPos.get(`${col},${row}`);
        const size = cellSize * (markStyle === "slash" ? 0.8 : 0.66);
        return (
          <div key={idx} className="road-cell">
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
  marks, cellSize, markStyle, minCols = DERIVED_MIN_COLS,
}: { marks: RoadMark[]; cellSize: number; markStyle: MarkStyle; minCols?: number }) {
  const placed = placeMarks(marks, ROWS);
  const maxCol = placed.length ? Math.max(...placed.map(p => p.col)) + 1 : 0;
  const cols = Math.max(maxCol, minCols);
  return <PlacedRoadGrid placed={placed} cellSize={cellSize} markStyle={markStyle} cols={cols} />;
}

// Cockroach Road — two stacked bands. Sticks travel left to right; when the
// top band runs out of columns the marks continue on the bottom band
// (matches casino display behaviour).
function CockroachBands({
  marks, cellSize, bandCols,
}: { marks: RoadMark[]; cellSize: number; bandCols: number }) {
  const placed = placeMarks(marks, ROWS);
  const top = placed.filter(p => p.col < bandCols);
  const bottom = placed
    .filter(p => p.col >= bandCols)
    .map(p => ({ ...p, col: p.col - bandCols }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <PlacedRoadGrid placed={top} cellSize={cellSize} markStyle="slash" cols={bandCols} />
      <PlacedRoadGrid placed={bottom} cellSize={cellSize} markStyle="slash" cols={bandCols} />
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
  titleCn, titleEn, children, style, align = "center", headerExtra,
}: {
  titleCn: string; titleEn: string; children: React.ReactNode;
  style?: React.CSSProperties; align?: "left" | "center";
  headerExtra?: React.ReactNode;
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
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

// ── Stats panel (bottom-right, casino style) ─────────────────────────────────
function StatsPanel({ outcomes, extras }: { outcomes: Outcome[]; extras?: (HandExtra | undefined)[] }) {
  const banker = outcomes.filter(o => o === "banker").length;
  const player = outcomes.filter(o => o === "player").length;
  const tie = outcomes.filter(o => o === "tie").length;

  const count = (pred: (e: HandExtra) => boolean) =>
    (extras ?? []).filter((e): e is HandExtra => !!e && pred(e)).length;
  const naturals = count(e => !!e.natural);
  const bPairs = count(e => !!e.bankerPair);
  const pPairs = count(e => !!e.playerPair);
  const tigers = count(e => e.variant === "sml-tiger" || e.variant === "lge-tiger");
  const dragons = count(e => e.variant === "sml-dragon" || e.variant === "big-dragon");
  const dragonTigers = count(e => !!e.variant?.startsWith("dragontiger-"));

  return (
    <div className="stats-panel">
      <div className="stats-row"><span className="stats-label">局数 Games</span><span className="stats-value games">{outcomes.length}</span></div>
      <div className="stats-row"><span className="stats-label"><span className="stats-dot banker-dot">庄</span>Banker</span><span className="stats-value banker">{banker}</span></div>
      <div className="stats-row"><span className="stats-label"><span className="stats-dot player-dot">闲</span>Player</span><span className="stats-value player">{player}</span></div>
      <div className="stats-row"><span className="stats-label"><span className="stats-dot tie-dot">和</span>Tie</span><span className="stats-value tie">{tie}</span></div>
      <div className="stats-side-grid">
        <span className="stats-side-item"><b className="marker-natural inline">N</b> Natural <b>{naturals}</b></span>
        <span className="stats-side-item"><span className="marker-pair banker-pair inline" /> B Pair <b>{bPairs}</b></span>
        <span className="stats-side-item">🐯 Tiger <b>{tigers}</b></span>
        <span className="stats-side-item"><span className="marker-pair player-pair inline" /> P Pair <b>{pPairs}</b></span>
        <span className="stats-side-item"><DragonIcon size={14} /> Dragon <b>{dragons}</b></span>
        <span className="stats-side-item"><span className="marker-variant dragontiger inline" style={{ width: 13, height: 13 }}>#</span> D-Tiger <b>{dragonTigers}</b></span>
      </div>
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
              <div className="legend-row"><span className="marker-pair player-pair inline" /> Player pair (top-right dot)</div>
              <div className="legend-row"><span className="marker-pair banker-pair inline" /> Banker pair (bottom-left dot)</div>
              <div className="legend-row"><span className="marker-variant tiger inline">🐯</span> Small Tiger — Banker wins on 6 (two cards); larger icon = Big Tiger (three cards)</div>
              <div className="legend-row"><span className="marker-variant dragon inline"><DragonIcon size={16} /></span> Small Dragon — Player wins 7 v Banker ≤5 (two cards); larger gold-edged icon = Big Dragon (three cards)</div>
              <div className="legend-row"><span className="marker-variant dragontiger inline">4</span> Dragon Tiger — Player 7 beats Banker 6; number shows total cards dealt (4, 5 or 6; Dragon bets also pay)</div>
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

function PredictorTable({ outcomes }: { outcomes: Outcome[] }) {
  const roads: { road: (s: BigRoadStone[]) => RoadMark[]; style: MarkStyle }[] = [
    { road: bigEyeBoy,    style: "donut" },
    { road: smallRoad,    style: "solid" },
    { road: cockroachPig, style: "slash" },
  ];
  return (
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
          <PredictorCell mark={nextMark(outcomes, "banker", road)} style={style} />
          <PredictorCell mark={nextMark(outcomes, "player", road)} style={style} />
        </Fragment>
      ))}
    </div>
  );
}

// ── Main export — casino screen layout ───────────────────────────────────────
export default function RoadsDisplay({ outcomes, extras, compact = false }: Props) {
  const stones = useMemo(() => toBigRoad(outcomes), [outcomes]);
  const beb    = useMemo(() => bigEyeBoy(stones),    [stones]);
  const sr     = useMemo(() => smallRoad(stones),    [stones]);
  const cp     = useMemo(() => cockroachPig(stones), [stones]);

  const bigCell   = compact ? 20 : 26;
  const smallCell = compact ? 11 : 13;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Row 1 — Big Road full width */}
      <RoadSection titleCn="大路" titleEn="Big Road" align="left"
        headerExtra={<><HeaderStats outcomes={outcomes} /><LegendKey /></>}>
        <BigRoad outcomes={outcomes} extras={extras} cellSize={bigCell} />
      </RoadSection>

      {/* Row 2 — left: Big Eye above Small Road · right: Cockroach two bands */}
      <div className="roads-mid-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <RoadSection titleCn="大眼仔" titleEn="Big Eye Boy">
            <DerivedRoad marks={beb} cellSize={smallCell} markStyle="donut" />
          </RoadSection>
          <RoadSection titleCn="小路" titleEn="Small Road">
            <DerivedRoad marks={sr} cellSize={smallCell} markStyle="solid" />
          </RoadSection>
        </div>
        <RoadSection titleCn="曱甴路" titleEn="Cockroach Road">
          <CockroachBands marks={cp} cellSize={smallCell} bandCols={DERIVED_MIN_COLS} />
        </RoadSection>
      </div>

      {/* Row 3 — Bead Plate left · stats panel right */}
      <div className="roads-bottom-grid">
        <RoadSection titleCn="珠盘路" titleEn="Bead Plate"
          headerExtra={<HeaderStats outcomes={outcomes} />}>
          <BeadPlate outcomes={outcomes} extras={extras} cellSize={bigCell} />
        </RoadSection>
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          <StatsPanel outcomes={outcomes} extras={extras} />
          <PredictorTable outcomes={outcomes} />
        </div>
      </div>
    </div>
  );
}
