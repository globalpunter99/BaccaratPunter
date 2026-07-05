// Backtest a strategy (with its variables) across saved boards.

import { useState } from "react";
import type { BacktestSummary } from "../game/backtest";
import { backtestBoards, DEFAULT_STAKING, type Staking } from "../game/backtest";
import type { Params, StrategyKey } from "../game/strategy";
import { defaultParams } from "../game/strategy";
import type { BoardRecord } from "../lib/db";
import { ErrorNote, StrategyPicker } from "./shared";

const fmt = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(2);

export default function BacktestTab({ boards }: { boards: BoardRecord[] }) {
  const [strategyKey, setStrategyKey] = useState<StrategyKey>("streakFollow");
  const [params, setParams] = useState<Params>(() => defaultParams("streakFollow"));
  const [staking, setStaking] = useState<Staking>(DEFAULT_STAKING);
  const [summary, setSummary] = useState<BacktestSummary | null>(null);

  function run() {
    setSummary(backtestBoards(boards, strategyKey, params, staking));
  }

  return (
    <>
      <section className="panel">
        <h2>Backtest</h2>
        <StrategyPicker
          strategyKey={strategyKey}
          params={params}
          onStrategyChange={(key) => {
            setStrategyKey(key);
            setParams(defaultParams(key));
            setSummary(null);
          }}
          onParamsChange={setParams}
        />
        <div className="picker">
          <label>
            Base unit&nbsp;
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={staking.baseUnit}
              onChange={(e) =>
                setStaking({ ...staking, baseUnit: Number(e.target.value) || 1 })
              }
            />
          </label>
          <label>
            Progression&nbsp;
            <select
              value={staking.progression}
              onChange={(e) =>
                setStaking({
                  ...staking,
                  progression: e.target.value as Staking["progression"],
                })
              }
            >
              <option value="flat">Flat</option>
              <option value="martingale">Martingale (double on loss)</option>
              <option value="paroli">Paroli (double on win)</option>
            </select>
          </label>
          {staking.progression !== "flat" && (
            <label>
              Cap (doublings)&nbsp;
              <input
                type="number"
                min={1}
                max={8}
                step={1}
                value={staking.capSteps}
                onChange={(e) =>
                  setStaking({ ...staking, capSteps: Number(e.target.value) || 1 })
                }
              />
            </label>
          )}
        </div>
        <div className="controls">
          <button disabled={boards.length === 0} onClick={run}>
            Run backtest on {boards.length} board{boards.length === 1 ? "" : "s"}
          </button>
        </div>
        {boards.length === 0 && (
          <ErrorNote message="No boards to test — record or simulate some in the Boards tab first." />
        )}
      </section>

      {summary && (
        <section className="panel">
          <h2>Results</h2>
          <table>
            <thead>
              <tr>
                <th>Board</th>
                <th>Rounds</th>
                <th>Bets</th>
                <th>W / L / Push</th>
                <th>Hit rate</th>
                <th>Net units</th>
                <th>Max DD</th>
              </tr>
            </thead>
            <tbody>
              {summary.perBoard.map(({ boardId, boardName, result: r }) => (
                <tr key={boardId}>
                  <td>{boardName}</td>
                  <td>{r.rounds}</td>
                  <td>{r.bets}</td>
                  <td>
                    {r.wins} / {r.losses} / {r.pushes}
                  </td>
                  <td>{(r.hitRate * 100).toFixed(1)}%</td>
                  <td className={r.net >= 0 ? "pos" : "neg"}>{fmt(r.net)}</td>
                  <td>{r.maxDrawdown.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="totals">
                <td>Total</td>
                <td>{summary.total.rounds}</td>
                <td>{summary.total.bets}</td>
                <td>
                  {summary.total.wins} / {summary.total.losses} /{" "}
                  {summary.total.pushes}
                </td>
                <td>{(summary.total.hitRate * 100).toFixed(1)}%</td>
                <td className={summary.total.net >= 0 ? "pos" : "neg"}>
                  {fmt(summary.total.net)}
                </td>
                <td>{summary.total.maxDrawdown.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p className="hint">
            Units assume player pays 1:1, banker 0.95:1, ties push. Adjust the
            variables above and re-run to compare settings.
          </p>
        </section>
      )}
    </>
  );
}
