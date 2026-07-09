import { useState } from "react";

type Step = 0 | 1 | 2 | 3 | 4 | 5;

interface Answers {
  sessionFrequency: string;
  primaryStrategy: string;
  windowDefinition: string[];
  minimumRoadsAligned: string;
  streakOrChop: string;
  sitOutThreshold: string;
  handsPerSession: string;
  confidenceThreshold: string;
}

const INITIAL: Answers = {
  sessionFrequency: "",
  primaryStrategy: "",
  windowDefinition: [],
  minimumRoadsAligned: "",
  streakOrChop: "",
  sitOutThreshold: "",
  handsPerSession: "",
  confidenceThreshold: "",
};

export default function ProfileBuilder() {
  const [step, setStep] = useState<Step>(0);
  const [answers, setAnswers] = useState<Answers>(INITIAL);
  const [done, setDone] = useState(false);

  function set<K extends keyof Answers>(key: K, val: Answers[K]) {
    setAnswers(prev => ({ ...prev, [key]: val }));
  }

  function toggleWindow(val: string) {
    setAnswers(prev => ({
      ...prev,
      windowDefinition: prev.windowDefinition.includes(val)
        ? prev.windowDefinition.filter(v => v !== val)
        : [...prev.windowDefinition, val],
    }));
  }

  if (done) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-title">Player Profile</div>
        <div className="panel" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--gold)", marginBottom: 8 }}>
            Profile Saved
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
            Your play profile has been saved. The signal engine will now use these settings
            to calibrate your "You" calls and window detection.
            As you record more sessions, the profile will refine itself automatically.
          </div>
          <div className="flex gap-8" style={{ justifyContent: "center" }}>
            <button className="btn btn-gold" onClick={() => { setDone(false); setStep(0); setAnswers(INITIAL); }}>
              Redo Profile
            </button>
            <button className="btn btn-secondary">View Profiles</button>
          </div>
        </div>

        {/* Summary */}
        <div className="panel mt-12">
          <div className="panel-title">Your Profile Summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["How often you play", answers.sessionFrequency],
              ["Primary approach", answers.primaryStrategy],
              ["Window signals", answers.windowDefinition.join(", ") || "—"],
              ["Minimum roads aligned", answers.minimumRoadsAligned],
              ["Prefer streak or chop", answers.streakOrChop],
              ["Sit-out threshold", answers.sitOutThreshold],
              ["Hands per session target", answers.handsPerSession],
              ["Min confidence to call", answers.confidenceThreshold],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
                <span style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>{value || "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const steps: React.ReactNode[] = [
    /* 0 — intro */
    <QuestionStep
      key={0}
      title="Let's build your play profile"
      subtitle="This questionnaire calibrates the signal engine to match the way you personally read baccarat roads. There are no right or wrong answers — it's about your style."
      onNext={() => setStep(1)}
      nextLabel="Get Started"
      canProceed
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        <InfoRow icon="🎯" text="Your profile defines what counts as a 'window' for you personally." />
        <InfoRow icon="📊" text="It sets the minimum confidence before the app shows you a call." />
        <InfoRow icon="🤖" text="Sniper and Grinder will be tuned as benchmarks based on your answers." />
        <InfoRow icon="🔄" text="You can update your profile anytime — more sessions = more accuracy." />
      </div>
    </QuestionStep>,

    /* 1 — frequency + style */
    <QuestionStep
      key={1}
      title="How do you play?"
      subtitle="Tell us about your typical casino visit."
      onNext={() => setStep(2)}
      onBack={() => setStep(0)}
      canProceed={!!answers.sessionFrequency && !!answers.primaryStrategy}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ChoiceGroup
          label="How often do you play baccarat?"
          options={["Once a week or more", "A few times a month", "Occasionally (monthly or less)", "Rarely — special occasions"]}
          value={answers.sessionFrequency}
          onChange={v => set("sessionFrequency", v)}
        />
        <ChoiceGroup
          label="When you sit down, what's your main approach?"
          options={[
            "I watch a few hands first, then enter when I see a pattern",
            "I play most hands and look for patterns as I go",
            "I follow a strict system or betting sequence",
            "I mix it — depends on how the shoe feels",
          ]}
          value={answers.primaryStrategy}
          onChange={v => set("primaryStrategy", v)}
        />
      </div>
    </QuestionStep>,

    /* 2 — window definition */
    <QuestionStep
      key={2}
      title="What makes a 'window' for you?"
      subtitle="Select everything that makes you feel confident enough to bet. Choose as many as apply."
      onNext={() => setStep(3)}
      onBack={() => setStep(1)}
      canProceed={answers.windowDefinition.length > 0}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { val: "bigroad_streak", label: "Big Road — a clear streak (same side 3+ in a row)" },
          { val: "bigroad_chop", label: "Big Road — alternating pattern (ping-pong)" },
          { val: "beb_aligned", label: "Big Eye Boy — mostly solid circles (regular pattern)" },
          { val: "sr_aligned", label: "Small Road — mostly solid (short-lookback alignment)" },
          { val: "cp_aligned", label: "Cockroach Road — mostly solid (long-lookback alignment)" },
          { val: "all_three_aligned", label: "All three derived roads aligned in the same direction" },
          { val: "column_depth", label: "Current Big Road column is already deep (5+ stones)" },
          { val: "new_column_start", label: "A new column just started — side just changed" },
        ].map(opt => (
          <label
            key={opt.val}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              background: answers.windowDefinition.includes(opt.val) ? "rgba(245,200,66,0.08)" : "var(--bg-dark)",
              border: `1px solid ${answers.windowDefinition.includes(opt.val) ? "var(--gold)" : "var(--border-panel)"}`,
              transition: "all 0.15s",
            }}
            onClick={() => toggleWindow(opt.val)}
          >
            <div style={{
              width: 18, height: 18, borderRadius: 3,
              background: answers.windowDefinition.includes(opt.val) ? "var(--gold)" : "transparent",
              border: `2px solid ${answers.windowDefinition.includes(opt.val) ? "var(--gold)" : "var(--border-panel)"}`,
              flexShrink: 0,
              marginTop: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, color: "var(--bg-dark)",
            }}>
              {answers.windowDefinition.includes(opt.val) ? "✓" : ""}
            </div>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{opt.label}</span>
          </label>
        ))}
      </div>
    </QuestionStep>,

    /* 3 — alignment threshold + preference */
    <QuestionStep
      key={3}
      title="How strict are your entry rules?"
      subtitle="These settings tune how selective your signal is."
      onNext={() => setStep(4)}
      onBack={() => setStep(2)}
      canProceed={!!answers.minimumRoadsAligned && !!answers.streakOrChop}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ChoiceGroup
          label="How many of the three derived roads (Big Eye, Small, Cockroach) need to be aligned before you'll bet?"
          options={["All 3 — I only play when everything lines up", "2 out of 3 — close enough", "1 is enough if Big Road confirms it", "I don't rely heavily on derived roads"]}
          value={answers.minimumRoadsAligned}
          onChange={v => set("minimumRoadsAligned", v)}
        />
        <ChoiceGroup
          label="Do you prefer to follow streaks or chops?"
          options={[
            "Streaks — I back the run to continue",
            "Chops — I play the alternation",
            "I follow whichever pattern is happening in the current shoe",
            "I look at the derived roads to decide, not my preference",
          ]}
          value={answers.streakOrChop}
          onChange={v => set("streakOrChop", v)}
        />
      </div>
    </QuestionStep>,

    /* 4 — volume + sit-out */
    <QuestionStep
      key={4}
      title="How do you manage your play volume?"
      subtitle="This calibrates how often the app will show you a signal."
      onNext={() => setStep(5)}
      onBack={() => setStep(3)}
      canProceed={!!answers.handsPerSession && !!answers.sitOutThreshold && !!answers.confidenceThreshold}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <ChoiceGroup
          label="On a typical shoe, how many hands do you actually bet?"
          options={["10 or fewer — very selective", "10–20 hands", "20–35 hands", "Most hands in the shoe"]}
          value={answers.handsPerSession}
          onChange={v => set("handsPerSession", v)}
        />
        <ChoiceGroup
          label="What do you do when roads are unreadable or conflicting?"
          options={[
            "I always sit out — I'd rather miss hands than bet blind",
            "I sit out for a few hands then re-assess",
            "I reduce my bet size but still play",
            "I play through it — patterns can emerge suddenly",
          ]}
          value={answers.sitOutThreshold}
          onChange={v => set("sitOutThreshold", v)}
        />
        <ChoiceGroup
          label="What's the lowest confidence you'd accept before placing a bet?"
          options={[
            "I only bet when I'm 80%+ confident",
            "60–79% is enough if the road looks good",
            "50–60% — I'll play on marginal reads",
            "I don't think in percentages — it's a gut feel",
          ]}
          value={answers.confidenceThreshold}
          onChange={v => set("confidenceThreshold", v)}
        />
      </div>
    </QuestionStep>,

    /* 5 — review */
    <QuestionStep
      key={5}
      title="Profile ready to save"
      subtitle="Here's a summary of your play style based on your answers."
      onNext={() => setDone(true)}
      onBack={() => setStep(4)}
      nextLabel="Save Profile"
      canProceed
    >
      <div style={{ background: "var(--bg-dark)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SummaryRow label="Playing frequency" value={answers.sessionFrequency} />
          <SummaryRow label="Entry approach" value={answers.primaryStrategy} />
          <SummaryRow label="Window signals" value={answers.windowDefinition.length + " signals selected"} />
          <SummaryRow label="Roads alignment needed" value={answers.minimumRoadsAligned} />
          <SummaryRow label="Streak or chop preference" value={answers.streakOrChop} />
          <SummaryRow label="Sit-out behaviour" value={answers.sitOutThreshold} />
          <SummaryRow label="Hands per session" value={answers.handsPerSession} />
          <SummaryRow label="Minimum confidence" value={answers.confidenceThreshold} />
        </div>
      </div>
    </QuestionStep>,
  ];

  return (
    <div className="page" style={{ maxWidth: 680 }}>
      <div className="page-title">Player Profile Builder</div>

      {/* Progress bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i <= step ? "var(--gold)" : "var(--border-panel)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {steps[step]}
    </div>
  );
}

function QuestionStep({
  title, subtitle, children, onNext, onBack, nextLabel = "Continue", canProceed,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  canProceed: boolean;
}) {
  return (
    <div className="panel">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{subtitle}</div>
      </div>
      {children}
      <div className="flex gap-8 mt-16">
        {onBack && (
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        )}
        <button
          className="btn btn-gold"
          onClick={onNext}
          disabled={!canProceed}
          style={{ opacity: canProceed ? 1 : 0.4, marginLeft: "auto" }}
        >
          {nextLabel} →
        </button>
      </div>
    </div>
  );
}

function ChoiceGroup({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--text-label)", marginBottom: 8, lineHeight: 1.5 }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {options.map(opt => (
          <label
            key={opt}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
              padding: "9px 12px",
              borderRadius: "var(--radius-sm)",
              background: value === opt ? "rgba(245,200,66,0.08)" : "var(--bg-dark)",
              border: `1px solid ${value === opt ? "var(--gold)" : "var(--border-panel)"}`,
              transition: "all 0.15s",
            }}
            onClick={() => onChange(opt)}
          >
            <div style={{
              width: 16, height: 16, borderRadius: "50%", flexShrink: 0, marginTop: 1,
              background: value === opt ? "var(--gold)" : "transparent",
              border: `2px solid ${value === opt ? "var(--gold)" : "var(--border-panel)"}`,
            }} />
            <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--gold)", fontWeight: 600, maxWidth: "60%", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{text}</span>
    </div>
  );
}
