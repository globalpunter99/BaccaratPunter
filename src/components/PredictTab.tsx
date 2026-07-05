// Live prediction: enter outcomes as a real shoe plays out and get the
// strategy's suggested next bet. The board can be saved when done.

import { useMemo, useState } from "react";
import type { Outcome } from "../game/baccarat";
import type { Params, StrategyKey } from "../game/strategy";
import { defaultParams, strategies } from "../game/strategy";
import { saveBoard } from "../lib/db";
import { BeadStrip, ErrorNote, OutcomePad, StrategyPicker } from "./shared";

export default function PredictTab({
  onBoardsChange,
}: {
  onBoardsChange: () => void;
}) {
  const [strategyKey, setStrategyKey] = useState<StrategyKey>("streakFollow");
  const [params, setParams] = useState<Params>(() => defaultParams("streakFollow"));
  const [live, setLive] = useState<Outcome[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const suggestion = useMemo(
    () => strategies[strategyKey].run({ history: live }, params),
    [strategyKey, params, live]
  );

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const name = `Live board ${new Date().toLocaleString()}`;
      await saveBoard(name, live);
      setSavedMsg(`Saved as “${name}” — it's now in your backtest set.`);
      setLive([]);
      onBoardsChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Predict</h2>
        <StrategyPicker
          strategyKey={strategyKey}
          params={params}
          onStrategyChange={(key) => {
            setStrategyKey(key);
            setParams(defaultParams(key));
          }}
          onParamsChange={setParams}
        />
        <div className={`suggestion bet-${suggestion.bet}`}>
          <span className="tag">Suggested next bet</span>
          <strong>{suggestion.bet.toUpperCase()}</strong>
          <span className="conf">
            {(suggestion.confidence * 100).toFixed(0)}% conf.
          </span>
          <p>{suggestion.reason}</p>
        </div>
      </section>

      <section className="panel">
        <h2>Live board ({live.length} rounds)</h2>
        <p className="hint">Tap each result as it lands at the table.</p>
        <OutcomePad
          outcomes={live}
          onChange={(next) => {
            setLive(next);
            setSavedMsg(null);
          }}
        />
        <BeadStrip outcomes={live} />
        <div className="controls">
          <button disabled={busy || live.length === 0} onClick={handleSave}>
            Save board for backtesting
          </button>
        </div>
        {savedMsg && <p className="hint">{savedMsg}</p>}
        <ErrorNote message={error} />
      </section>
    </>
  );
}
