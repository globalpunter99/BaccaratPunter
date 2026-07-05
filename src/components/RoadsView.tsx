// Renders the traditional Macau road screens from an outcome list:
// Bead Plate, Big Road, and the three derived roads. Pure display — every
// grid is recomputed from `outcomes` on each render (see game/roads.ts).

import { useMemo } from "react";
import type { Outcome } from "../game/baccarat";
import {
  bigEyeBoy,
  cockroachPig,
  smallRoad,
  toBeadPlate,
  toBigRoad,
  type RoadMark,
} from "../game/roads";

const LETTER: Record<Outcome, string> = { player: "P", banker: "B", tie: "T" };

function BeadPlate({ outcomes }: { outcomes: Outcome[] }) {
  const cells = toBeadPlate(outcomes);
  return (
    <div className="road-grid">
      {cells.map((c, i) => (
        <span
          key={i}
          className={`cell bead ${c.outcome}`}
          style={{ gridColumn: c.col + 1, gridRow: c.row + 1 }}
        >
          {LETTER[c.outcome]}
        </span>
      ))}
    </div>
  );
}

function BigRoad({ outcomes }: { outcomes: Outcome[] }) {
  const stones = toBigRoad(outcomes);
  return (
    <div className="road-grid">
      {stones.map((s, i) => (
        <span
          key={i}
          className={`cell stone ${s.side}`}
          style={{ gridColumn: s.col + 1, gridRow: Math.min(s.rowInCol, 6) }}
          title={s.ties > 0 ? `${s.ties} tie(s) here` : undefined}
        >
          {s.ties > 0 && <span className="tie-badge">{s.ties}</span>}
        </span>
      ))}
    </div>
  );
}

/** Derived roads have no P/B side — just red/blue marks packed 6-per-column. */
function DerivedRoad({ marks }: { marks: RoadMark[] }) {
  if (marks.length === 0)
    return <p className="muted">Not enough history yet.</p>;
  return (
    <div className="road-grid sm">
      {marks.map((m, i) => (
        <span
          key={i}
          className={`cell mark ${m}`}
          style={{ gridColumn: Math.floor(i / 6) + 1, gridRow: (i % 6) + 1 }}
        />
      ))}
    </div>
  );
}

export default function RoadsView({ outcomes }: { outcomes: Outcome[] }) {
  const stones = useMemo(() => toBigRoad(outcomes), [outcomes]);
  const derived = useMemo(
    () => ({
      bigEye: bigEyeBoy(stones),
      small: smallRoad(stones),
      cockroach: cockroachPig(stones),
    }),
    [stones]
  );

  if (outcomes.length === 0)
    return <p className="empty">Enter results to see the roads.</p>;

  return (
    <div className="roads">
      <div className="road-block">
        <div className="road-title">Bead Plate</div>
        <BeadPlate outcomes={outcomes} />
      </div>

      <div className="road-block">
        <div className="road-title">Big Road</div>
        <BigRoad outcomes={outcomes} />
      </div>

      <div className="derived-roads">
        <div className="road-block">
          <div className="road-title">Big Eye Boy</div>
          <DerivedRoad marks={derived.bigEye} />
        </div>
        <div className="road-block">
          <div className="road-title">Small Road</div>
          <DerivedRoad marks={derived.small} />
        </div>
        <div className="road-block">
          <div className="road-title">Cockroach Pig</div>
          <DerivedRoad marks={derived.cockroach} />
        </div>
      </div>
    </div>
  );
}
