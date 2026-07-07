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

// ── Bead Plate ──────────────────────────────────────────────────────────────
function BeadPlate({ outcomes, cellSize }: { outcomes: Outcome[]; cellSize: number }) {
  const cells = toBeadPlate(outcomes, ROWS);
  const cols = Math.max(Math.ceil(outcomes.length / ROWS), 12);

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
        const col = Math.floor(idx / ROWS);
        const row = idx % ROWS;
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
  const maxCol = stones.length ? Math.max(...stones.map(s => s.col)) + 1 : 12;
  const displayCols = Math.max(maxCol, 12);
  const displayRows = ROWS;

  const grid: (BigRoadStone | null)[][] = Array.from({ length: displayRows }, () =>
    Array(displayCols).fill(null)
  );

  for (const stone of stones) {
    const row = Math.min(stone.rowInCol - 1, displayRows - 1);
    const col = stone.col;
    if (row >= 0 && col < displayCols) grid[row][col] = stone;
  }

  return (
    <div
      className="road-grid"
      style={{
        gridTemplateColumns: `repeat(${displayCols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${displayRows}, ${cellSize}px)`,
        width: displayCols * cellSize,
        minWidth: "100%",
      }}
    >
      {grid.flat().map((stone, idx) => (
        <div key={idx} className="road-cell">
          {stone && (
            <>
              <div
                className={`road-stone ${stone.side}`}
                style={{ width: cellSize * 0.72, height: cellSize * 0.72 }}
              />
              {stone.ties > 0 && (
                <div className="tie-slash" />
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Derived Road (Big Eye Boy / Small Road / Cockroach Pig) ──────────────────
function DerivedRoad({
  marks, cellSize, rows = 6,
}: { marks: RoadMark[]; cellSize: number; rows?: number }) {
  const cols = Math.max(Math.ceil(marks.length / rows), 8);
  return (
    <div
      className="road-grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
        width: cols * cellSize,
        minWidth: "100%",
      }}
    >
      {Array.from({ length: rows * cols }).map((_, idx) => {
        const mark = marks[idx];
        return (
          <div key={idx} className="road-cell">
            {mark && (
              <div
                className={`road-stone ${mark === "red" ? "red-mark" : "blue-mark"}`}
                style={{ width: cellSize * 0.68, height: cellSize * 0.68 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Road Section Wrapper ─────────────────────────────────────────────────────
function RoadSection({
  titleCn, titleEn, children,
}: { titleCn: string; titleEn: string; children: React.ReactNode }) {
  return (
    <div className="road-section">
      <div className="road-section-header">
        <span className="road-section-title-cn">{titleCn}</span>
        <span className="road-section-title-en">{titleEn}</span>
      </div>
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

// ── Main Export ──────────────────────────────────────────────────────────────
export default function RoadsDisplay({ outcomes, compact = false }: Props) {
  const stones = useMemo(() => toBigRoad(outcomes), [outcomes]);
  const beb    = useMemo(() => bigEyeBoy(stones),   [stones]);
  const sr     = useMemo(() => smallRoad(stones),   [stones]);
  const cp     = useMemo(() => cockroachPig(stones), [stones]);

  const bigCell    = compact ? 22 : 28;
  const smallCell  = compact ? 14 : 18;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Big Road — full width */}
      <RoadSection titleCn="大路" titleEn="Big Road">
        <BigRoad outcomes={outcomes} cellSize={bigCell} />
      </RoadSection>

      {/* Bead Plate */}
      <RoadSection titleCn="珠盘路" titleEn="Bead Plate">
        <BeadPlate outcomes={outcomes} cellSize={bigCell} />
      </RoadSection>

      {/* Three derived roads side by side */}
      <div className="grid-3">
        <RoadSection titleCn="大眼仔" titleEn="Big Eye Road">
          <DerivedRoad marks={beb} cellSize={smallCell} />
        </RoadSection>
        <RoadSection titleCn="小路" titleEn="Small Road">
          <DerivedRoad marks={sr} cellSize={smallCell} />
        </RoadSection>
        <RoadSection titleCn="蟑螂路" titleEn="Cockroach Road">
          <DerivedRoad marks={cp} cellSize={smallCell} />
        </RoadSection>
      </div>
    </div>
  );
}
