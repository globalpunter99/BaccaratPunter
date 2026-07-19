import { useState } from "react";
import { PAYOUT_LABELS, DEFAULT_PAYOUTS, type PayoutTable } from "../../game/payouts";
import {
  loadPayoutSettings, savePayoutSettings, makeGameType,
  type PayoutSettings, type CasinoConfig, type GameType,
} from "../../lib/payoutSettings";
import { loadAccount, saveAccount, isValidPasscode, type Account } from "../../lib/accountStore";

const FIELDS = Object.keys(PAYOUT_LABELS) as (keyof PayoutTable)[];

function PayoutEditor({
  table, onChange,
}: { table: PayoutTable; onChange: (t: PayoutTable) => void }) {
  return (
    <div className="payout-grid">
      {FIELDS.map(f => (
        <label key={f} className="payout-field">
          <span className="payout-label">{PAYOUT_LABELS[f]}</span>
          <span className="payout-input-wrap">
            <input
              className="input"
              type="number"
              min={0}
              step={0.5}
              value={table[f]}
              onChange={e => onChange({ ...table, [f]: parseFloat(e.target.value) || 0 })}
            />
            <span className="payout-suffix">: 1</span>
          </span>
        </label>
      ))}
    </div>
  );
}

// ── Account (front-end prototype — real auth lands with Supabase) ──
function AccountCard() {
  const [account, setAccount] = useState<Account>(() => loadAccount());
  const [pinDraft, setPinDraft] = useState("");
  const [pinEditing, setPinEditing] = useState(false);
  const [stub, setStub] = useState<string | null>(null);

  function update(next: Account) {
    setAccount(next);
    saveAccount(next);
  }
  function flashStub(msg: string) {
    setStub(msg);
    setTimeout(() => setStub(null), 3200);
  }
  function savePin() {
    if (!isValidPasscode(pinDraft)) return;
    update({ ...account, passcode: pinDraft });
    setPinDraft("");
    setPinEditing(false);
  }

  const hasPin = !!account.passcode;

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-title">Account</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
        Your profile and sign-in options. Password reset and Face&nbsp;ID become
        active once the account backend is connected.
      </div>

      {/* Username + email */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 560, marginBottom: 14 }}>
        <label className="field-col">
          <span className="field-label">Username</span>
          <input className="input" placeholder="Your username"
            value={account.username}
            onChange={e => update({ ...account, username: e.target.value })} />
        </label>
        <label className="field-col">
          <span className="field-label">Email</span>
          <input className="input" type="email" placeholder="you@example.com"
            value={account.email}
            onChange={e => update({ ...account, email: e.target.value })} />
        </label>
      </div>

      {/* Passcode */}
      <div style={{ borderTop: "1px solid var(--border-panel)", paddingTop: 12, marginBottom: 12 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <span className="field-label" style={{ marginBottom: 0 }}>4-digit passcode</span>
          <span style={{ fontSize: 12, color: hasPin ? "var(--tie-green)" : "var(--text-muted)" }}>
            {hasPin ? "● ● ● ● set" : "not set"}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
          A quick lock for opening the app on your device. Stored on this device only for now.
        </div>
        {pinEditing || !hasPin ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ width: 110, letterSpacing: 4, textAlign: "center" }}
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              value={pinDraft}
              onChange={e => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
              onKeyDown={e => e.key === "Enter" && savePin()}
            />
            <button className="btn btn-secondary" style={{ fontSize: 12 }}
              onClick={savePin} disabled={!isValidPasscode(pinDraft)}>
              {hasPin ? "Update passcode" : "Set passcode"}
            </button>
            {pinEditing && (
              <button className="btn btn-ghost" style={{ fontSize: 12 }}
                onClick={() => { setPinEditing(false); setPinDraft(""); }}>
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12 }}
              onClick={() => setPinEditing(true)}>Change</button>
            <button className="btn btn-ghost" style={{ fontSize: 12 }}
              onClick={() => update({ ...account, passcode: null })}>Remove</button>
          </div>
        )}
      </div>

      {/* Face ID */}
      <div className="flex items-center justify-between" style={{ borderTop: "1px solid var(--border-panel)", paddingTop: 12, marginBottom: 12 }}>
        <div>
          <div className="field-label" style={{ marginBottom: 2 }}>Face&nbsp;ID / biometric login</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Uses your device biometrics. Activates when the account backend is connected.
          </div>
        </div>
        <button
          className={`btn ${account.faceId ? "btn-secondary" : "btn-ghost"}`}
          style={{ fontSize: 12, padding: "5px 16px" }}
          onClick={() => {
            update({ ...account, faceId: !account.faceId });
            if (!account.faceId) flashStub("Face ID preference saved. It will take effect once biometric sign-in is connected to the backend.");
          }}
        >
          {account.faceId ? "On" : "Off"}
        </button>
      </div>

      {/* Reset password (stub) */}
      <div className="flex items-center justify-between" style={{ borderTop: "1px solid var(--border-panel)", paddingTop: 12 }}>
        <div>
          <div className="field-label" style={{ marginBottom: 2 }}>Password</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Send a reset link to your email.
          </div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }}
          onClick={() => flashStub(
            account.email
              ? `A reset link will be sent to ${account.email} once the account backend is connected.`
              : "Add your email above first — then a reset link can be sent once the backend is connected.")}>
          Reset password
        </button>
      </div>

      {stub && (
        <div style={{
          marginTop: 12, padding: "8px 12px", borderRadius: "var(--radius-sm)", fontSize: 12,
          background: "rgba(245,200,66,0.08)", border: "1px solid var(--gold)", color: "var(--text-secondary)",
        }}>
          {stub}
        </div>
      )}
    </div>
  );
}

// ── Casinos & their baccarat game types ──
function CasinoManager({
  settings, onChange,
}: { settings: PayoutSettings; onChange: (s: PayoutSettings) => void }) {
  const [newCasino, setNewCasino] = useState("");

  function addCasino() {
    const name = newCasino.trim();
    if (!name) return;
    if (settings.casinos.some(c => c.name.toLowerCase() === name.toLowerCase())) return;
    const casino: CasinoConfig = {
      id: `c-${Date.now()}`,
      name,
      games: [makeGameType("Commission", settings.defaults)],
    };
    onChange({ ...settings, casinos: [...settings.casinos, casino] });
    setNewCasino("");
  }
  function updateCasino(id: string, patch: Partial<CasinoConfig>) {
    onChange({
      ...settings,
      casinos: settings.casinos.map(c => (c.id === id ? { ...c, ...patch } : c)),
    });
  }
  function removeCasino(id: string) {
    onChange({ ...settings, casinos: settings.casinos.filter(c => c.id !== id) });
  }
  function updateGames(casino: CasinoConfig, games: GameType[]) {
    updateCasino(casino.id, { games });
  }

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-title">Casinos &amp; Game Types</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Add each casino you play, then name the baccarat game types it offers —
        Commission, Non-Commission, Even Money and so on. Each game type carries
        its own odds, used automatically by Live Session and the Session Library
        when you pick that casino and game. Whether 5% commission applies is set
        per session in Live Session &gt; Session Details.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, maxWidth: 460 }}>
        <input
          className="input"
          placeholder="Casino name (e.g. Crown Melbourne)"
          value={newCasino}
          onChange={e => setNewCasino(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addCasino()}
        />
        <button className="btn btn-secondary" onClick={addCasino} disabled={!newCasino.trim()}>
          + Add casino
        </button>
      </div>

      {settings.casinos.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          No casinos yet — add one above. Sessions with no matching casino use the default odds below.
        </div>
      )}

      {settings.casinos.map(casino => (
        <div key={casino.id} className="panel" style={{ background: "var(--bg-dark)", marginBottom: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 10, gap: 8 }}>
            <input
              className="input"
              style={{ fontWeight: 700, color: "var(--gold)", maxWidth: 300 }}
              value={casino.name}
              onChange={e => updateCasino(casino.id, { name: e.target.value })}
            />
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => removeCasino(casino.id)}>
              ✕ Remove casino
            </button>
          </div>

          {casino.games.map(game => (
            <div key={game.id} style={{
              border: "1px solid var(--border-panel)", borderRadius: "var(--radius-sm)",
              padding: 12, marginBottom: 10,
            }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
                <label className="field-col" style={{ flex: 1, minWidth: 180 }}>
                  <span className="field-label">Game type name</span>
                  <input
                    className="input"
                    placeholder="e.g. Non-Commission"
                    value={game.name}
                    onChange={e => updateGames(casino, casino.games.map(g =>
                      g.id === game.id ? { ...g, name: e.target.value } : g))}
                  />
                </label>
                {casino.games.length > 1 && (
                  <button className="btn btn-ghost" style={{ fontSize: 12 }}
                    onClick={() => updateGames(casino, casino.games.filter(g => g.id !== game.id))}>
                    ✕ Remove game
                  </button>
                )}
              </div>
              <PayoutEditor
                table={game.table}
                onChange={t => updateGames(casino, casino.games.map(g =>
                  g.id === game.id ? { ...g, table: t } : g))}
              />
            </div>
          ))}

          <button
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            onClick={() => updateGames(casino, [
              ...casino.games,
              makeGameType("Non-Commission", settings.defaults),
            ])}
          >
            + Add game type
          </button>
        </div>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PayoutSettings>(() => loadPayoutSettings());
  const [savedFlash, setSavedFlash] = useState(false);

  function update(next: PayoutSettings) {
    setSettings(next);
    savePayoutSettings(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-12">
        <div className="page-title" style={{ marginBottom: 0, border: "none", paddingBottom: 0 }}>Settings</div>
        {savedFlash && <span style={{ fontSize: 12, color: "var(--tie-green)", fontWeight: 600 }}>✓ Saved</span>}
      </div>

      <AccountCard />

      <CasinoManager settings={settings} onChange={update} />

      {/* Default payout table */}
      <div className="panel">
        <div className="panel-title">Default Odds</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Used for any session whose casino and game type aren't configured above.
          Odds are profit per unit staked — a winning bet also returns its stake.
        </div>
        <PayoutEditor
          table={settings.defaults}
          onChange={t => update({ ...settings, defaults: t })}
        />
        <button
          className="btn btn-ghost"
          style={{ marginTop: 10, fontSize: 12 }}
          onClick={() => update({ ...settings, defaults: { ...DEFAULT_PAYOUTS } })}
        >
          Reset to market defaults
        </button>
      </div>
    </div>
  );
}
