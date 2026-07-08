import { useMemo } from "react";
import type { Outcome } from "../../game/baccarat";
import {
  toBeadPlate, toBigRoad, bigEyeBoy, smallRoad, cockroachPig,
  type BigRoadStone, type RoadMark,
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
  const stones = toBigRoad(outcomes);
  const maxCol = stones.length ? Math.max(...stones.map(s => s.col)) + 1 : 0;
  const displayCols = Math.max(maxCol, BIG_ROAD_MIN_COLS);

  const grid: (BigRoadStone | null)[][] = Array.from({ length: ROWS }, () =>
    Array(displayCols).fill(null)
  );
  for (const stone of stones) {
    const row = Math.min(stone.rowInCol - 1, ROWS - 1);
    if (row >= 0 && stone.col < displayCols) grid[row][stone.col] = stone;
  }

  return (
    <div
      className="road-grid"
      style={{
        gridTemplateColumns: `repeat(${displayCols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${cellSize}px)`,
        width: displayCols * cellSize,
        minWidth: "100%",
      }}
    >
      {grid.flat().map((stone, idx) => (
        <div key={idx} className="road-cell">
          {stone && (
            <>
              <div
                className={`road-stone big-road-${stone.side}`}
                style={{ width: cellSize * 0.72, height: cellSize * 0.72 }}
              />
              {stone.ties > 0 && <div className="tie-slash" />}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Derived Roads ────────────────────────────────────────────────────────────
// Big Eye Road: hollow circles ("donuts") · Small Road: solid circles ·
// Cockroach: diagonal slashes.
type MarkStyle = "donut" | "solid" | "slash";

function DerivedRoadGrid({
  marks, cellSize, markStyle, cols,
}: { marks: RoadMark[]; cellSize: number; markStyle: MarkStyle; cols: number }) {
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
        const mark = marks[col * ROWS + row];
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
  const cols = Math.max(Math.ceil(marks.length / ROWS), minCols);
  return <DerivedRoadGrid marks={marks} cellSize={cellSize} markStyle={markStyle} cols={cols} />;
}

// Cockroach Road — two stacked bands. Sticks travel left to right; when the
// top band runs out of columns the marks continue on the bottom band
// (matches casino display behaviour).
function CockroachBands({
  marks, cellSize, bandCols,
}: { marks: RoadMark[]; cellSize: number; bandCols: number }) {
  const perBand = bandCols * ROWS;
  const top = marks.slice(0, perBand);
  const bottom = marks.slice(perBand, perBand * 2);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <DerivedRoadGrid marks={top} cellSize={cellSize} markStyle="slash" cols={bandCols} />
      <DerivedRoadGrid marks={bottom} cellSize={cellSize} markStyle="slash" cols={bandCols} />
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function RoadSection({
  titleCn, titleEn, children, style,
}: { titleCn: string; titleEn: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="road-section" style={style}>
      <div className="road-section-header">
        <span className="road-section-title-cn">{titleCn}</span>
        <span className="road-section-title-en">{titleEn}</span>
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
// ┌──────────────────── Big Road ────────────────────┐
// ├── Big Eye Road ──────────┬── Cockroach (band 1) ──┤
// ├── Small Road ────────────┤── Cockroach (band 2) ──┤
// ├── Bead Plate ────────────┴── Stats panel ─────────┤
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
      <RoadSection titleCn="大路" titleEn="Big Road">
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
        <RoadSection titleCn="珠盘路" titleEn="Bead Plate">
          <BeadPlate outcomes={outcomes} cellSize={bigCell} />
        </RoadSection>
        <StatsPanel outcomes={outcomes} />
      </div>
    </div>
  );
}
