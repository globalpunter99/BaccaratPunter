import { useMemo, useState } from "react";
import type { Outcome } from "./game/baccarat";
import { buildShoe, dealFromShoe } from "./game/baccarat";
import { strategies, type StrategyKey } from "./game/strategy";
import { isSupabaseConfigured } from "./lib/supabase";

interface Row {
  round: number;
  outcome: Outcome;
  playerTotal: number;
  bankerTotal: number;
}

export default function App() {
  const [shoe] = useState(() => buildShoe(8));
  const [cursor] = useState(() => ({ i: 0 }));
  const [rows, setRows] = useState<Row[]>([]);
  const [strategyKey, setStrategyKey] = useState<StrategyKey>("streak");

  const history = useMemo(() => rows.map((r) => r.outcome), [rows]);
  const suggestion = useMemo(
    () => strategies[strategyKey].run({ history }),
    [strategyKey, history]
  );

  function deal() {
    // Reshuffle-safe: stop near the end of the shoe.
    if (cursor.i > shoe.length - 20) return;
    const round = dealFromShoe(shoe, cursor);
    setRows((prev) => [
      ...prev,
      {
        round: prev.length + 1,
        outcome: round.outcome,
        playerTotal: round.playerTotal,
        bankerTotal: round.bankerTotal,
      },
    ]);
  }

  const counts = useMemo(() => {
    const c = { player: 0, banker: 0, tie: 0 };
    for (const o of history) c[o]++;
    return c;
  }, [history]);

  return (
    <main className="wrap">
      <header>
        <h1>Baccarat Strategy</h1>
        <p className="sub">
          Deal rounds, track outcomes, and test strategies. A directive can be
          plugged into the strategy engine later.
        </p>
      </header>

      <section className="panel">
        <div className="controls">
          <label>
            Strategy&nbsp;
            <select
              value={strategyKey}
              onChange={(e) => setStrategyKey(e.target.value as StrategyKey)}
            >
              {Object.entries(strategies).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button onClick={deal}>Deal round</button>
        </div>

        <div className={`suggestion bet-${suggestion.bet}`}>
          <span className="tag">Suggested bet</span>
          <strong>{suggestion.bet.toUpperCase()}</strong>
          <span className="conf">
            {(suggestion.confidence * 100).toFixed(0)}% conf.
          </span>
          <p>{suggestion.reason}</p>
        </div>

        <div className="tallies">
          <span className="t player">Player {counts.player}</span>
          <span className="t banker">Banker {counts.banker}</span>
          <span className="t tie">Tie {counts.tie}</span>
        </div>
      </section>

      <section className="panel">
        <h2>History</h2>
        {rows.length === 0 ? (
          <p className="empty">No rounds yet — deal to begin.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Banker</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice()
                .reverse()
                .map((r) => (
                  <tr key={r.round}>
                    <td>{r.round}</td>
                    <td>{r.playerTotal}</td>
                    <td>{r.bankerTotal}</td>
                    <td className={`res ${r.outcome}`}>{r.outcome}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>

      <footer>
        Supabase: {isSupabaseConfigured ? "connected" : "not configured"} · For
        study and simulation only.
      </footer>
    </main>
  );
}
