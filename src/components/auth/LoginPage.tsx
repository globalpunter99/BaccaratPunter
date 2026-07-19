// Sign-in / sign-up screen shown when the backend is configured and no user
// is signed in. Styled to match the app shell.

import { useState } from "react";
import { useAuth } from "../../lib/auth";

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    const err = mode === "in"
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password, username.trim() || email.split("@")[0]);
    setBusy(false);
    if (err === "CONFIRM_EMAIL") {
      setNotice("Account created — check your email for the confirmation link, then sign in.");
      setMode("in");
    } else if (err) {
      setError(err);
    }
    // On success the auth listener takes over and the app renders.
  }

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  return (
    <div className="app-shell" style={{ minHeight: "100vh" }}>
      <div style={{
        maxWidth: 400, margin: "10vh auto 0", padding: "0 16px",
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="app-logo" style={{ justifyContent: "center", fontSize: 24 }}>
            BaccaratPunter
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
            Sign {mode === "in" ? "in to your account" : "up for an account"}
          </div>
        </div>

        <div className="panel">
          {mode === "up" && (
            <label className="field-col" style={{ marginBottom: 10 }}>
              <span className="field-label">Username</span>
              <input className="input" placeholder="Your display name"
                value={username} onChange={e => setUsername(e.target.value)} />
            </label>
          )}
          <label className="field-col" style={{ marginBottom: 10 }}>
            <span className="field-label">Email</span>
            <input className="input" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && canSubmit && submit()} />
          </label>
          <label className="field-col" style={{ marginBottom: 14 }}>
            <span className="field-label">Password</span>
            <input className="input" type="password"
              placeholder={mode === "up" ? "At least 6 characters" : "Password"}
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && canSubmit && submit()} />
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
          {notice && (
            <div style={{
              marginBottom: 12, padding: "8px 12px", borderRadius: "var(--radius-sm)",
              fontSize: 12, background: "rgba(245,200,66,0.08)",
              border: "1px solid var(--gold)", color: "var(--text-secondary)",
            }}>
              {notice}
            </div>
          )}

          <button className="btn btn-gold" style={{ width: "100%", padding: "9px 0" }}
            disabled={!canSubmit || busy} onClick={submit}>
            {busy ? "…" : mode === "in" ? "Sign In" : "Create Account"}
          </button>

          <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "var(--text-muted)" }}>
            {mode === "in" ? (
              <>No account?{" "}
                <button className="link-btn" onClick={() => { setMode("up"); setError(null); }}>
                  Sign up
                </button></>
            ) : (
              <>Already registered?{" "}
                <button className="link-btn" onClick={() => { setMode("in"); setError(null); }}>
                  Sign in
                </button></>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
