// Small shared UI pieces: outcome entry pad, bead strip, strategy picker.

import type { Outcome } from "../game/baccarat";
import type { Params, StrategyKey } from "../game/strategy";
import { strategies } from "../game/strategy";

const LETTER: Record<Outcome, string> = { player: "P", banker: "B", tie: "T" };

/** Compact colored strip showing a board's outcomes, oldest first. */
export function BeadStrip({ outcomes }: { outcomes: Outcome[] }) {
  if (outcomes.length === 0) return <p className="empty">No results yet.</p>;
  return (
    <div className="beads">
      {outcomes.map((o, i) => (
        <span key={i} className={`bead ${o}`}>
          {LETTER[o]}
        </span>
      ))}
    </div>
  );
}

/** Tap pad for entering outcomes, with undo/clear. */
export function OutcomePad({
  outcomes,
  onChange,
}: {
  outcomes: Outcome[];
  onChange: (next: Outcome[]) => void;
}) {
  return (
    <div className="pad">
      <button className="pad-btn player" onClick={() => onChange([...outcomes, "player"])}>
        Player
      </button>
      <button className="pad-btn banker" onClick={() => onChange([...outcomes, "banker"])}>
        Banker
      </button>
      <button className="pad-btn tie" onClick={() => onChange([...outcomes, "tie"])}>
        Tie
      </button>
      <button
        className="pad-btn ghost"
        disabled={outcomes.length === 0}
        onClick={() => onChange(outcomes.slice(0, -1))}
      >
        Undo
      </button>
      <button
        className="pad-btn ghost"
        disabled={outcomes.length === 0}
        onClick={() => onChange([])}
      >
        Clear
      </button>
    </div>
  );
}

/** Strategy dropdown plus auto-rendered inputs for its variables. */
export function StrategyPicker({
  strategyKey,
  params,
  onStrategyChange,
  onParamsChange,
}: {
  strategyKey: StrategyKey;
  params: Params;
  onStrategyChange: (key: StrategyKey) => void;
  onParamsChange: (params: Params) => void;
}) {
  const strategy = strategies[strategyKey];
  return (
    <div className="picker">
      <label>
        Strategy&nbsp;
        <select
          value={strategyKey}
          onChange={(e) => onStrategyChange(e.target.value)}
        >
          {Object.entries(strategies).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      {Object.entries(strategy.params).map(([name, spec]) => (
        <label key={name}>
          {spec.label}&nbsp;
          <input
            type="number"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={params[name] ?? spec.default}
            onChange={(e) =>
              onParamsChange({ ...params, [name]: Number(e.target.value) })
            }
          />
        </label>
      ))}
      <p className="hint">{strategy.description}</p>
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="error">{message}</p>;
}
