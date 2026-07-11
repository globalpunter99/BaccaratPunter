import { useState } from "react";
import { PAYOUT_LABELS, DEFAULT_PAYOUTS, type PayoutTable } from "../../game/payouts";
import { loadPayoutSettings, savePayoutSettings, type PayoutSettings } from "../../lib/payoutSettings";

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<PayoutSettings>(() => loadPayoutSettings());
  const [newCasino, setNewCasino] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  function update(next: PayoutSettings) {
    setSettings(next);
    savePayoutSettings(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  function addCasino() {
    const name = newCasino.trim();
    if (!name) return;
    if (settings.casinos.some(c => c.name.toLowerCase() === name.toLowerCase())) return;
    update({
      ...settings,
      casinos: [...settings.casinos, { name, table: { ...settings.defaults } }],
    });
    setNewCasino("");
  }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-12">
        <div className="page-title" style={{ marginBottom: 0, border: "none", paddingBottom: 0 }}>Settings</div>
        {savedFlash && <span style={{ fontSize: 12, color: "var(--tie-green)", fontWeight: 600 }}>✓ Saved</span>}
      </div>

      {/* Default payout table */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-title">Default Side-Bet Payouts</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Used for any session whose casino doesn't have its own table below.
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

      {/* Casino-specific tables */}
      <div className="panel">
        <div className="panel-title">Casino-Specific Payouts</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Add a casino to give it its own odds. A live or practice session uses the
          casino's table automatically when the session's casino name matches.
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14, maxWidth: 420 }}>
          <input
            className="input"
            placeholder="Casino name (e.g. Crown Melbourne)"
            value={newCasino}
            onChange={e => setNewCasino(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCasino()}
          />
          <button className="btn btn-secondary" onClick={addCasino} disabled={!newCasino.trim()}>
            + Add
          </button>
        </div>

        {settings.casinos.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            No casino-specific tables yet — all sessions use the defaults.
          </div>
        )}

        {settings.casinos.map((c, i) => (
          <div key={c.name} className="panel" style={{ background: "var(--bg-dark)", marginBottom: 12 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--gold)" }}>{c.name}</div>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12 }}
                onClick={() => update({
                  ...settings,
                  casinos: settings.casinos.filter((_, j) => j !== i),
                })}
              >
                ✕ Remove
              </button>
            </div>
            <PayoutEditor
              table={c.table}
              onChange={t => update({
                ...settings,
                casinos: settings.casinos.map((cc, j) => (j === i ? { ...cc, table: t } : cc)),
              })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
