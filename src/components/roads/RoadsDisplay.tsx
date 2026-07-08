import { useMemo, useState } from "react";
import type { Outcome } from "../../game/baccarat";
import {
  toBeadPlate, toBigRoad, bigEyeBoy, smallRoad, cockroachPig,
  placeBigRoad, placeMarks,
  type RoadMark, type PlacedCell, type BigRoadStone,
} from "../../game/roads";

interface Props {
  outcomes: Outcome[];
  compact?: boolean;
}

const ROWS = 6;
const BIG_ROAD_MIN_COLS = 36;
const DERIVED_MIN_COLS = 36; // big eye / small road: 6 deep, 36 across
const BEAD_MIN_COLS = 18;

// ── Bead Plate ──────────────────────────────────────────────────────────────
// Populated top-to-bottom, left-to-right (column-major fill).
function BeadPlate({ outcomes, cellSize }: { outcomes: Outcome[]; cellSize: number }) {
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
        const cell = cells.find(c => c.col === col && c.row === row);
        return (
          <div key={idx} className="road-cell">
            {cell && (
              <div
                className={`road-stone ${cell.outcome}`}
                style={{ width: cellSize * 0.72, height: cellSize * 0.72 }}
              >
                {cell.outcome === "banker" ? "B" : cell.outcome === "player" ? "P" : "T"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Big Road ─────────────────────────────────────────────────────────────────
function BigRoad({ outcomes, cellSize }: { outcomes: Outcome[]; cellSize: number }) {
  const placed = placeBigRoad(toBigRoad(outcomes), ROWS);
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
                {p.value.ties > 0 && <div className="tie-slash" />}
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
      {visible && (
        <>
          <span className="header-stat"><span className="header-stat-label">Game</span> <span className="stats-value games" style={{ fontSize: 13 }}>{outcomes.length}</span></span>
          <span className="header-stat"><span className="header-stat-label">Banker</span> <span className="stats-value banker" style={{ fontSize: 13 }}>{banker}</span></span>
          <span className="header-stat"><span className="header-stat-label">Player</span> <span className="stats-value player" style={{ fontSize: 13 }}>{player}</span></span>
          <span className="header-stat"><span className="header-stat-label">Tie</span> <span className="stats-value tie" style={{ fontSize: 13 }}>{tie}</span></span>
        </>
      )}
      <button
        className="eye-toggle"
        title={visible ? "Hide stats" : "Show stats"}
        onClick={() => setVisible(v => !v)}
      >
        {visible ? "👁" : "🙈"}
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
      <div className={`road-section-header ${align === "left" ? "align-left" : "align-center"}`}>
        <span className="road-section-title-en">{titleEn}</span>
        <span className="road-section-title-sep">/</span>
        <span className="road-section-title-cn">{titleCn}</span>
        {headerExtra && <span className="header-extra">{headerExtra}</span>}
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
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
      <div className="stats-row"><span className="stats-label"><span className="stats-dot banker-dot" />庄 Banker</span><span className="stats-value banker">{banker}</span></div>
      <div className="stats-row"><span className="stats-label"><span className="stats-dot player-dot" />闲 Player</span><span className="stats-value player">{player}</span></div>
      <div className="stats-row"><span className="stats-label"><span className="stats-dot tie-dot" />和 Tie</span><span className="stats-value tie">{tie}</span></div>
    </div>
  );
}

// ── Main export — casino screen layout ───────────────────────────────────────
export default function RoadsDisplay({ outcomes, compact = false }: Props) {
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
        headerExtra={<HeaderStats outcomes={outcomes} />}>
        <BigRoad outcomes={outcomes} cellSize={bigCell} />
      </RoadSection>

      {/* Row 2 — left: Big Eye above Small Road · right: Cockroach two bands */}
      <div className="roads-mid-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <RoadSection titleCn="大眼仔" titleEn="Big Eye Road">
            <DerivedRoad marks={beb} cellSize={smallCell} markStyle="donut" />
          </RoadSection>
          <RoadSection titleCn="小路" titleEn="Small Road">
            <DerivedRoad marks={sr} cellSize={smallCell} markStyle="solid" />
          </RoadSection>
        </div>
        <RoadSection titleCn="蟑螂路" titleEn="Cockroach Road">
          <CockroachBands marks={cp} cellSize={smallCell} bandCols={DERIVED_MIN_COLS} />
        </RoadSection>
      </div>

      {/* Row 3 — Bead Plate left · stats panel right */}
      <div className="roads-bottom-grid">
        <RoadSection titleCn="珠盘路" titleEn="Bead Plate"
          headerExtra={<HeaderStats outcomes={outcomes} />}>
          <BeadPlate outcomes={outcomes} cellSize={bigCell} />
        </RoadSection>
        <StatsPanel outcomes={outcomes} />
      </div>
    </div>
  );
}
