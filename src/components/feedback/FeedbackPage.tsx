// Feedback tab. Every signed-in user gets the submit form (Subject/Topic
// dropdown + free-text description) and a confirmation screen afterwards.
// The super admin additionally gets the submissions list — RLS makes that
// admin-only at the database layer, not just in this component.

import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";
import {
  FEEDBACK_SUBJECTS, listFeedback, submitFeedback, type FeedbackRow,
} from "../../lib/feedback";

function SubmitForm({ onSent }: { onSent: (subject: string) => void }) {
  const { userId, profile } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = subject !== "" && message.trim().length >= 5 && !busy;

  async function submit() {
    if (!canSubmit || !userId) return;
    setBusy(true);
    setError(null);
    const err = await submitFeedback(subject, message.trim(), {
      userId,
      username: profile?.username ?? "",
      email: profile?.email ?? "",
    });
    setBusy(false);
    if (err) setError(err);
    else onSent(subject);
  }

  return (
    <div className="panel" style={{ maxWidth: 620 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
        Found a bug, or want something to work differently? Tell us here. Pick the
        closest topic so it reaches the right place, then describe it in your own
        words — the more specific the better.
      </div>

      <label className="field-col" style={{ marginBottom: 12 }}>
        <span className="field-label">Subject / Topic</span>
        <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
          <option value="">Choose a topic…</option>
          {FEEDBACK_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <label className="field-col" style={{ marginBottom: 14 }}>
        <span className="field-label">Description</span>
        <textarea
          className="input"
          rows={8}
          placeholder="What happened, what you expected, and where in the app you were."
          style={{ resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }}
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <span style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          {message.trim().length < 5
            ? "A few words at least, please."
            : `${message.trim().length} characters`}
        </span>
      </label>

      {error && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: "var(--radius-sm)",
          fontSize: 12, background: "rgba(220,60,60,0.12)",
          border: "1px solid var(--banker-red)", color: "var(--text-secondary)",
        }}>
          {error}
        </div>
      )}

      <button className="btn btn-gold" style={{ padding: "9px 26px" }}
        disabled={!canSubmit} onClick={submit}>
        {busy ? "Sending…" : "Submit Feedback"}
      </button>
    </div>
  );
}

function Confirmation({ subject, onAgain }: { subject: string; onAgain: () => void }) {
  return (
    <div className="panel" style={{ maxWidth: 620, textAlign: "center", padding: "34px 24px" }}>
      <div style={{ fontSize: 38, lineHeight: 1, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        Thanks — your feedback was submitted
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 20 }}>
        Topic: <b style={{ color: "var(--text-primary)" }}>{subject}</b>
        <br />
        It has been logged and a copy sent to the team. We read every one, though
        we can't reply to all of them.
      </div>
      <button className="btn btn-ghost" onClick={onAgain}>Send more feedback</button>
    </div>
  );
}

function FeedbackList() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    listFeedback().then(r => {
      setRows(r.rows);
      setError(r.error);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading feedback…</div>;
  if (error) {
    return (
      <div style={{
        padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: 12,
        background: "rgba(220,60,60,0.12)", border: "1px solid var(--banker-red)",
        color: "var(--text-secondary)",
      }}>
        {error}
      </div>
    );
  }
  if (rows.length === 0) {
    return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No feedback submitted yet.</div>;
  }

  return (
    <div className="panel table-scroll" style={{ padding: 0 }}>
      <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--bg-dark)", textAlign: "left" }}>
            {["Received", "From", "Subject", "Message"].map(h => (
              <th key={h} style={{ padding: "10px 14px", fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const expanded = open === r.id;
            return (
              <tr key={r.id} style={{ borderTop: "1px solid var(--border-panel)", cursor: "pointer" }}
                onClick={() => setOpen(expanded ? null : r.id)}>
                <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: 12, whiteSpace: "nowrap" }}>
                  {new Date(r.created_at).toLocaleString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontWeight: 600 }}>{r.username || "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.email}</div>
                </td>
                <td style={{ padding: "10px 14px", color: "var(--gold)", fontWeight: 600 }}>{r.subject}</td>
                <td style={{
                  padding: "10px 14px", color: "var(--text-secondary)",
                  whiteSpace: expanded ? "pre-wrap" : "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis",
                  maxWidth: expanded ? undefined : 320,
                }}>
                  {r.message}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function FeedbackPage() {
  const { isSuperAdmin } = useAuth();
  const [view, setView] = useState<"form" | "sent">("form");
  const [sentSubject, setSentSubject] = useState("");
  const [tab, setTab] = useState<"submit" | "list">("submit");

  return (
    <div className="page">
      <div className="page-title">Feedback</div>

      {isSuperAdmin && (
        <div className="view-toggle" style={{ marginLeft: 0, marginBottom: 14 }}>
          <button className={`view-toggle-btn ${tab === "submit" ? "active" : ""}`}
            onClick={() => setTab("submit")}>Submit</button>
          <button className={`view-toggle-btn ${tab === "list" ? "active" : ""}`}
            onClick={() => setTab("list")}>All Submissions</button>
        </div>
      )}

      {isSuperAdmin && tab === "list" ? (
        <FeedbackList />
      ) : view === "sent" ? (
        <Confirmation subject={sentSubject} onAgain={() => setView("form")} />
      ) : (
        <SubmitForm onSent={s => { setSentSubject(s); setView("sent"); }} />
      )}
    </div>
  );
}
