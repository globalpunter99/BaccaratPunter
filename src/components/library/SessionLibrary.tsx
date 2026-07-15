import { useState } from "react";
import { mockSessions, type Session } from "../../mock/data";
import RoadsDisplay from "../roads/RoadsDisplay";
import PredictionAnalysis from "./PredictionAnalysis";

export default function SessionLibrary() {
  const [selected, setSelected] = useState<Session | null>(null);
  const [filter, setFilter] = useState<"all" | "live" | "extra">("all");

  const filtered = mockSessions.filter(s => filter === "all" || s.type === filter);

  const bankerCount = (s: Session) => s.hands.filter(h => h.outcome === "banker").length;
  const playerCount = (s: Session) => s.hands.filter(h => h.outcome === "player").length;
  const tieCount    = (s: Session) => s.hands.filter(h => h.outcome === "tie").length;

  if (selected) {
    return (
      <div className="page">
        <div className="flex items-center justify-between mb-12">
          <div>
            <div className="page-title">Session Detail</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {selected.venue} · {selected.tableNumber} · {selected.date}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={() => setSelected(null)}>
            ← Back to Library
          </button>
        </div>

        {selected.notes && (
          <div className="mb-12" style={{ padding: "8px 12px", background: "var(--bg-dark)", borderRadius: "var(--radius-sm)", fontSize: 13, color: "var(--text-secondary)" }}>
            {selected.notes}
          </div>
        )}

        <PredictionAnalysis session={selected}>
          <RoadsDisplay outcomes={selected.hands.map(h => h.outcome)} betsToggle={false} />
        </PredictionAnalysis>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-12">
        <div className="page-title">Session Library</div>
        <div className="flex gap-8">
          {(["all", "live", "extra"] as const).map(f => (
            <button
              key={f}
              className={`btn ${filter === f ? "btn-gold" : "btn-ghost"}`}
              style={{ padding: "5px 14px", fontSize: 12 }}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All Sessions" : f === "live" ? "Live Only" : "Uploaded Only"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(s => (
          <div
            key={s.id}
            className="panel"
            style={{ cursor: "pointer", transition: "border-color 0.15s" }}
            onClick={() => setSelected(s)}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--border-accent)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border-panel)")}
          >
            <div className="flex items-center justify-between">
              <div className="flex gap-12 items-center">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.venue}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {s.tableNumber} · {s.date}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 3,
                    background: s.type === "live" ? "rgba(0,200,83,0.15)" : "rgba(245,200,66,0.15)",
                    color: s.type === "live" ? "var(--signal-green)" : "var(--gold)",
                    border: `1px solid ${s.type === "live" ? "var(--signal-green)" : "var(--gold)"}`,
                    textTransform: "uppercase",
                  }}
                >
                  {s.type === "live" ? "Live" : "Uploaded"}
                </span>
              </div>

              <div className="flex gap-16 items-center">
                <div style={{ fontSize: 13, textAlign: "right" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{s.hands.length} hands &nbsp;</span>
                  <span className="text-red">B:{bankerCount(s)}</span>
                  {" "}
                  <span className="text-blue">P:{playerCount(s)}</span>
                  {" "}
                  <span className="text-green">T:{tieCount(s)}</span>
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: 18 }}>›</span>
              </div>
            </div>

            {s.notes && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                {s.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
