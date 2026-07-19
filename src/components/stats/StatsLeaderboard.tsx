import { mockLeaderboard, mockSessions } from "../../mock/data";

export default function StatsLeaderboard() {
  const totalHands = mockSessions.reduce((sum, s) => sum + s.hands.length, 0);
  const totalSessions = mockSessions.length;

  return (
    <div className="page">
      <div className="page-title">Stats &amp; Leaderboard</div>

      {/* Top stats */}
      <div className="grid-4 mb-16">
        <div className="panel stat-block">
          <div className="stat-value">{totalSessions}</div>
          <div className="stat-label">Sessions Recorded</div>
        </div>
        <div className="panel stat-block">
          <div className="stat-value">{totalHands}</div>
          <div className="stat-label">Total Hands</div>
        </div>
        <div className="panel stat-block">
          <div className="stat-value text-green">58%</div>
          <div className="stat-label">Your Best Win Rate</div>
        </div>
        <div className="panel stat-block">
          <div className="stat-value text-gold">+14</div>
          <div className="stat-label">Best Session (units)</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Leaderboard */}
        <div className="panel">
          <div className="panel-title">Top Performances — All Sessions</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            Ranked by hit rate. Only hands where a call was made (not all hands played).
          </div>
          <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Model</th>
                <th>Session</th>
                <th>Hit Rate</th>
                <th>Calls</th>
                <th>Units</th>
              </tr>
            </thead>
            <tbody>
              {mockLeaderboard.map(row => (
                <tr key={row.rank}>
                  <td style={{ color: "var(--text-muted)", fontWeight: 600 }}>{row.rank}</td>
                  <td>
                    <span style={{
                      color: row.model === "You" ? "var(--gold)" : row.model === "Sniper" ? "#aa88ff" : "#55ccff",
                      fontWeight: 600,
                    }}>
                      {row.model}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{row.session}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: row.hitRate >= 60 ? "var(--signal-green)" : row.hitRate >= 55 ? "var(--gold)" : "var(--text-secondary)" }}>
                        {row.hitRate}%
                      </span>
                      <div style={{ width: 40, height: 4, background: "var(--bg-dark)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${row.hitRate}%`, height: "100%", background: row.hitRate >= 60 ? "var(--signal-green)" : "var(--gold)", borderRadius: 2 }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{row.calls}</td>
                  <td style={{ color: row.units.startsWith("+") ? "var(--signal-green)" : row.units === "0" ? "var(--text-muted)" : "var(--banker-red)", fontWeight: 600 }}>
                    {row.units}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* Per-model breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="panel">
            <div className="panel-title">Model Averages — All Sessions</div>
            {[
              { name: "You",     color: "var(--gold)",    hitRate: 58, sessions: 2, totalCalls: 32, totalUnits: "+20" },
              { name: "Sniper",  color: "#aa88ff",        hitRate: 54, sessions: 4, totalCalls: 118, totalUnits: "+10" },
              { name: "Grinder", color: "#55ccff",        hitRate: 51, sessions: 4, totalCalls: 164, totalUnits: "+4" },
            ].map(m => (
              <div key={m.name} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-panel)" }}>
                <div className="flex justify-between items-center mb-8">
                  <span style={{ fontWeight: 600, color: m.color }}>{m.name}</span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{m.sessions} sessions</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  <MiniStat label="Hit Rate" value={`${m.hitRate}%`} color={m.color} />
                  <MiniStat label="Total Calls" value={m.totalCalls.toString()} color={m.color} />
                  <MiniStat label="Total Units" value={m.totalUnits} color={m.color} />
                </div>
              </div>
            ))}
          </div>

          {/* Session breakdown */}
          <div className="panel">
            <div className="panel-title">Sessions Breakdown</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Hands</th>
                  <th>B%</th>
                  <th>P%</th>
                </tr>
              </thead>
              <tbody>
                {mockSessions.map(s => {
                  const b = s.hands.filter(h => h.outcome === "banker").length;
                  const p = s.hands.filter(h => h.outcome === "player").length;
                  const tot = s.hands.length;
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{s.venue.split(" ")[0]}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.date}</div>
                      </td>
                      <td>{tot}</td>
                      <td style={{ color: "var(--banker-red)" }}>{Math.round(b/tot*100)}%</td>
                      <td style={{ color: "var(--player-blue)" }}>{Math.round(p/tot*100)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* What the numbers mean */}
      <div className="panel mt-12">
        <div className="panel-title">Understanding Your Numbers</div>
        <div className="grid-2" style={{ gap: 16 }}>
          <ExplainerItem
            title="Why 50% hit rate is the baseline"
            body="Ignoring ties, banker wins about 51% of hands vs player's 49%. So a model that just always calls Banker would hit roughly 51%. Anything you or the machines score above 51% is genuine value from road-reading — the question is whether it's consistent."
          />
          <ExplainerItem
            title="What 'units' means"
            body="One unit = one flat bet (whatever your standard stake is). +14 means you won 14 units more than you lost in that session. We track units rather than dollars so the numbers stay useful regardless of your bet size."
          />
          <ExplainerItem
            title="How hit rate and units can differ"
            body="You could win 60% of hands but still lose units if you bet bigger on the ones you lose. This program tracks both — over time, the combination tells you whether your entry timing adds value."
          />
          <ExplainerItem
            title="The Grinder benchmark"
            body="Grinder plays almost every hand. If you're not beating Grinder's hit rate, your selective reads aren't adding value over a high-volume approach. If you are beating it — your window-reading is working."
          />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: "var(--bg-dark)", borderRadius: "var(--radius-sm)", padding: "6px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ExplainerItem({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: "10px 14px", background: "var(--bg-dark)", borderRadius: "var(--radius-sm)", borderLeft: "3px solid var(--border-accent)" }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-label)", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}
