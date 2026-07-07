import { mockProfileStats } from "../../mock/data";

export default function ProfileComparison() {
  return (
    <div className="page">
      <div className="page-title">Player Profiles</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 16 }}>
        How you and both machine models are performing across all recorded sessions.
        Numbers are based on your actual play history — the more sessions you record, the more accurate these become.
      </div>

      {/* Summary cards */}
      <div className="grid-3 mb-16">
        <ProfileCard
          name="You"
          tagline="Your calibrated play profile"
          color="var(--gold)"
          stats={[
            { label: "Win rate", value: "58%" },
            { label: "Avg confidence", value: "79%" },
            { label: "Hands per session", value: "18" },
            { label: "Best session", value: "+14 units" },
          ]}
          description="You play selectively — fewer calls, higher conviction. You wait for the window and sit out when roads are unclear. This discipline keeps your win rate above 50% but means you miss some hands."
        />
        <ProfileCard
          name="Sniper"
          tagline="Machine model — precision focus"
          color="#aa88ff"
          stats={[
            { label: "Win rate", value: "54%" },
            { label: "Avg confidence", value: "68%" },
            { label: "Hands per session", value: "31" },
            { label: "Best session", value: "+11 units" },
          ]}
          description="Sniper looks for strong road alignment and streak continuation patterns. It calls more hands than you but is still selective. Its signals lean toward Banker and favour longer column runs."
        />
        <ProfileCard
          name="Grinder"
          tagline="Machine model — high volume"
          color="#55ccff"
          stats={[
            { label: "Win rate", value: "51%" },
            { label: "Avg confidence", value: "55%" },
            { label: "Hands per session", value: "44" },
            { label: "Best session", value: "+8 units" },
          ]}
          description="Grinder plays almost every non-tie hand, using a wide set of road signals. It wins roughly half the time — close to the base rate. It's useful as a benchmark: if you're not beating Grinder, you're not adding anything with your reads."
        />
      </div>

      {/* Comparison table */}
      <div className="panel">
        <div className="panel-title">Side-by-Side Comparison</div>
        <div style={{ marginBottom: 10 }}>
          <div className="profile-row" style={{ borderBottom: "1px solid var(--border-panel)", paddingBottom: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Metric
            </div>
            <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              You
            </div>
            <div style={{ fontSize: 11, color: "#aa88ff", fontWeight: 600, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Sniper
            </div>
            <div style={{ fontSize: 11, color: "#55ccff", fontWeight: 600, textAlign: "center", textTransform: "uppercase", letterSpacing: "0.8px" }}>
              Grinder
            </div>
          </div>
          {mockProfileStats.map((row, i) => (
            <div key={i} className="profile-row">
              <div className="profile-label">{row.label}</div>
              <div className="profile-you">{row.you}</div>
              <div className="profile-model" style={{ color: "#aa88ff" }}>{row.sniper}</div>
              <div className="profile-model" style={{ color: "#55ccff" }}>{row.grinder}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Insight panel */}
      <div className="panel mt-12">
        <div className="panel-title">What this tells you</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <InsightRow
            icon="🎯"
            text="Your win rate (58%) is above both machines. This is a good sign — your road-reading instincts are producing better entry timing than the automated models."
          />
          <InsightRow
            icon="⏸"
            text="You play fewer hands per session (18 vs Sniper's 31). This selectivity is a strength — you're not forcing plays when the road isn't clear."
          />
          <InsightRow
            icon="📊"
            text="Grinder is your baseline. Anything below 50% means the shoe was genuinely hard to read. Anything above Grinder means your reads added value over random calling."
          />
          <InsightRow
            icon="🔍"
            text="Your average confidence of 79% when calling is high. Track whether this stays calibrated as more sessions are added — if your win rate drops but confidence stays high, you may be overreading patterns."
          />
        </div>
      </div>
    </div>
  );
}

function ProfileCard({
  name, tagline, color, stats, description,
}: {
  name: string;
  tagline: string;
  color: string;
  stats: { label: string; value: string }[];
  description: string;
}) {
  return (
    <div className="panel" style={{ borderTop: `3px solid ${color}` }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color }}>{name}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{tagline}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: "var(--bg-dark)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {description}
      </div>
    </div>
  );
}

function InsightRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{text}</span>
    </div>
  );
}
