import { useCallback, useState } from "react";
import BacktestTab from "./components/BacktestTab";
import BoardsTab from "./components/BoardsTab";
import PredictTab from "./components/PredictTab";
import type { BoardRecord } from "./lib/db";
import { listBoards } from "./lib/db";
import { isSupabaseConfigured } from "./lib/supabase";

type Tab = "boards" | "backtest" | "predict";

const TABS: { key: Tab; label: string }[] = [
  { key: "boards", label: "Boards" },
  { key: "backtest", label: "Backtest" },
  { key: "predict", label: "Predict" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("boards");
  const [boards, setBoards] = useState<BoardRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshBoards = useCallback(() => {
    listBoards()
      .then((b) => {
        setBoards(b);
        setLoadError(null);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  return (
    <main className="wrap">
      <header>
        <h1>Baccarat Strategy</h1>
        <p className="sub">
          Record boards, backtest strategy variables, and get live suggestions.
        </p>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {loadError && <p className="error">{loadError}</p>}

      {tab === "boards" && (
        <BoardsTab boards={boards} onBoardsChange={refreshBoards} />
      )}
      {tab === "backtest" && <BacktestTab boards={boards} />}
      {tab === "predict" && <PredictTab onBoardsChange={refreshBoards} />}

      <footer>
        Supabase: {isSupabaseConfigured ? "connected" : "not configured"} · For
        study and simulation only. Past boards don't change future odds — treat
        backtests as descriptive, not predictive.
      </footer>
    </main>
  );
}
