// Record real boards (shoes) result-by-result and save them to Supabase.
// Also offers a simulated board generator for building test data.

import { useEffect, useState } from "react";
import type { Outcome } from "../game/baccarat";
import { buildShoe, dealFromShoe } from "../game/baccarat";
import type { BoardRecord } from "../lib/db";
import { deleteBoard, saveBoard } from "../lib/db";
import { BeadStrip, ErrorNote, OutcomePad } from "./shared";

function simulateBoard(): Outcome[] {
  const shoe = buildShoe(8);
  const cursor = { i: 0 };
  const outcomes: Outcome[] = [];
  // Deal until the cut-card region near the end of the shoe.
  while (cursor.i <= shoe.length - 20) {
    outcomes.push(dealFromShoe(shoe, cursor).outcome);
  }
  return outcomes;
}

export default function BoardsTab({
  boards,
  onBoardsChange,
}: {
  boards: BoardRecord[];
  onBoardsChange: () => void;
}) {
  const [entry, setEntry] = useState<Outcome[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onBoardsChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await saveBoard(name.trim() || `Board ${new Date().toLocaleString()}`, entry, note.trim());
      setEntry([]);
      setName("");
      setNote("");
      onBoardsChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteBoard(id);
      onBoardsChange();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Record a board</h2>
        <p className="hint">
          Enter results in order as they happened. Save when the shoe is done.
        </p>
        <OutcomePad outcomes={entry} onChange={setEntry} />
        <BeadStrip outcomes={entry} />
        <div className="controls">
          <input
            placeholder="Board name (e.g. Crown table 12, 5 Jul)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button disabled={busy || entry.length === 0} onClick={handleSave}>
            Save board ({entry.length})
          </button>
          <button className="ghost" onClick={() => setEntry(simulateBoard())}>
            Simulate board
          </button>
        </div>
        <ErrorNote message={error} />
      </section>

      <section className="panel">
        <h2>Saved boards ({boards.length})</h2>
        {boards.length === 0 ? (
          <p className="empty">
            No boards saved yet — record one above, or check that the Supabase
            migration has been applied.
          </p>
        ) : (
          boards.map((b) => {
            const c = { player: 0, banker: 0, tie: 0 };
            for (const o of b.outcomes) c[o]++;
            return (
              <details key={b.id} className="board-row">
                <summary>
                  <strong>{b.name}</strong>
                  <span className="muted">
                    {b.outcomes.length} rounds · P {c.player} / B {c.banker} / T{" "}
                    {c.tie} · {new Date(b.created_at).toLocaleDateString()}
                  </span>
                </summary>
                {b.note && <p className="hint">{b.note}</p>}
                <BeadStrip outcomes={b.outcomes} />
                <button className="ghost danger" onClick={() => handleDelete(b.id)}>
                  Delete
                </button>
              </details>
            );
          })
        )}
      </section>
    </>
  );
}
