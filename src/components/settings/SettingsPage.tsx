import { useState } from "react";
import {
  PAYOUT_LABELS, DEFAULT_PAYOUTS, SIDE_BET_TYPES, SIDE_BET_LABELS,
  type PayoutTable, type SideBetType,
} from "../../game/payouts";
import {
  loadPayoutSettings, saveDefaults, upsertCasino, removeCasino,
  makeGameType, newCasino, TRADITIONAL_NAME,
  type PayoutSettings, type CasinoConfig, type GameType,
} from "../../lib/payoutSettings";
import { loadAccount, saveAccount, isValidPasscode, type Account } from "../../lib/accountStore";
import { useAuth } from "../../lib/auth";

const FIELDS = Object.keys(PAYOUT_LABELS) as (keyof PayoutTable)[];

// Which odds fields a side bet needs, so a variant's editor only shows the odds
// for the side bets it actually offers.
const SIDE_BET_ODDS_KEYS: Record<SideBetType, (keyof PayoutTable)[]> = {
  tie: ["tie"],
  bPair: ["bPair"], pPair: ["pPair"], anyPair: ["anyPair"],
  smlTiger: ["smlTiger"], bigTiger: ["bigTiger"], anyTiger: ["anyTiger"], tigerTie: ["tigerTie"],
  smlDragon: ["smlDragon"], bigDragon: ["bigDragon"], dragonTie: ["dragonTie"],
  dragonTiger: ["dragonTiger4", "dragonTiger5", "dragonTiger6"],
};

const isTraditional = (name: string) => name.trim().toLowerCase() === TRADITIONAL_NAME.toLowerCase();

function PayoutEditor({
  table, onChange, fields = FIELDS,
}: { table: PayoutTable; onChange: (t: PayoutTable) => void; fields?: (keyof PayoutTable)[] }) {
  return (
    <div className="payout-grid">
      {fields.map(f => (
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, maxWidth: 560, marginBottom: 14 }}>
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

// ── One editable game variant (not Traditional) ──
function VariantEditor({
  game, onChange, onRemove,
}: { game: GameType; onChange: (g: GameType) => void; onRemove: () => void }) {
  const oddsFields = game.sideBets.flatMap(sb => SIDE_BET_ODDS_KEYS[sb]);
  function toggleSide(sb: SideBetType) {
    const has = game.sideBets.includes(sb);
    onChange({ ...game, sideBets: has ? game.sideBets.filter(s => s !== sb) : [...game.sideBets, sb] });
  }
  return (
    <div style={{ border: "1px solid var(--border-panel)", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 10 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <label className="field-col" style={{ flex: 1, minWidth: 180 }}>
          <span className="field-label">Variant name</span>
          <input className="input" placeholder="e.g. Tiger, Non-Commission"
            value={game.name}
            onChange={e => onChange({ ...game, name: e.target.value })} />
        </label>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onRemove}>✕ Remove variant</button>
      </div>

      <div className="flex items-center gap-8" style={{ marginBottom: 10 }}>
        <span className="field-label" style={{ marginBottom: 0 }}>5% commission on Banker win</span>
        <button className={`btn ${game.commission ? "btn-secondary" : "btn-ghost"}`}
          style={{ padding: "4px 14px", fontSize: 12 }} onClick={() => onChange({ ...game, commission: true })}>Yes</button>
        <button className={`btn ${!game.commission ? "btn-secondary" : "btn-ghost"}`}
          style={{ padding: "4px 14px", fontSize: 12 }} onClick={() => onChange({ ...game, commission: false })}>No</button>
      </div>

      <div className="field-label">Side bets offered</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: game.sideBets.length ? 12 : 0 }}>
        {SIDE_BET_TYPES.map(sb => (
          <button key={sb}
            className={`btn ${game.sideBets.includes(sb) ? "btn-secondary" : "btn-ghost"}`}
            style={{ fontSize: 11, padding: "4px 10px" }}
            onClick={() => toggleSide(sb)}>
            {game.sideBets.includes(sb) ? "✓ " : ""}{SIDE_BET_LABELS[sb]}
          </button>
        ))}
      </div>

      {oddsFields.length > 0 && (
        <>
          <div className="field-label">Odds for the offered side bets</div>
          <PayoutEditor table={game.table} fields={oddsFields}
            onChange={t => onChange({ ...game, table: t })} />
        </>
      )}
    </div>
  );
}

// ── One casino card ──
function CasinoCard({
  casino, defaults, canEdit, canSetUniversal, onChange, onRemove,
}: {
  casino: CasinoConfig; defaults: PayoutTable; canEdit: boolean; canSetUniversal: boolean;
  onChange: (c: CasinoConfig) => void; onRemove: () => void;
}) {
  const setGames = (games: GameType[]) => onChange({ ...casino, games });
  const traditional = casino.games.find(g => isTraditional(g.name));
  const variants = casino.games.filter(g => !isTraditional(g.name));

  if (!canEdit) {
    // Read-only (a universal casino someone else published)
    return (
      <div className="panel" style={{ background: "var(--bg-dark)", marginBottom: 14 }}>
        <div className="flex items-center gap-8" style={{ marginBottom: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, color: "var(--gold)" }}>{casino.name}</span>
          <span className="session-badge extra">Universal</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
          {casino.games.map(g => (
            <div key={g.id}>
              • <b>{g.name}</b> — {g.commission ? "5% commission" : "non-commission"}
              {g.sideBets.length ? ` · side bets: ${g.sideBets.map(s => SIDE_BET_LABELS[s]).join(", ")}` : " · no side bets"}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ background: "var(--bg-dark)", marginBottom: 14 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
        <input className="input" style={{ fontWeight: 700, color: "var(--gold)", maxWidth: 300 }}
          value={casino.name} onChange={e => onChange({ ...casino, name: e.target.value })} />
        <div className="flex items-center gap-8">
          {canSetUniversal && (
            <button
              className={`btn ${casino.universal ? "btn-secondary" : "btn-ghost"}`}
              style={{ fontSize: 12 }}
              title="Universal casinos are shown to every user account"
              onClick={() => onChange({ ...casino, universal: !casino.universal })}>
              {casino.universal ? "✓ Universal" : "Make universal"}
            </button>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onRemove}>✕ Remove casino</button>
        </div>
      </div>

      {/* Traditional — always present, locked */}
      <div style={{ border: "1px solid var(--border-panel)", borderRadius: "var(--radius-sm)", padding: "10px 12px", marginBottom: 10, opacity: 0.9 }}>
        <div className="flex items-center gap-8" style={{ flexWrap: "wrap" }}>
          <b style={{ color: "var(--text-primary)" }}>{traditional?.name ?? TRADITIONAL_NAME}</b>
          <span className="session-badge live">Default</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
          5% commission on a Banker win, no side bets. Every casino has this game and it can't be removed.
        </div>
      </div>

      {variants.map(game => (
        <VariantEditor key={game.id} game={game}
          onChange={g => setGames(casino.games.map(x => (x.id === g.id ? g : x)))}
          onRemove={() => setGames(casino.games.filter(x => x.id !== game.id))} />
      ))}

      <button className="btn btn-ghost" style={{ fontSize: 12 }}
        onClick={() => setGames([...casino.games, makeGameType("New Variant", defaults, { commission: false, sideBets: [] })])}>
        + Add game variant
      </button>
    </div>
  );
}

// ── Casinos section ──
function CasinoManager({
  settings, ownerId, isSuperAdmin, onUpsert, onRemove,
}: {
  settings: PayoutSettings; ownerId: string | null; isSuperAdmin: boolean;
  onUpsert: (c: CasinoConfig) => void; onRemove: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newUniversal, setNewUniversal] = useState(false);

  function addCasino() {
    const name = newName.trim();
    if (!name) return;
    if (settings.casinos.some(c => c.name.toLowerCase() === name.toLowerCase())) return;
    onUpsert(newCasino(name, { universal: isSuperAdmin && newUniversal, owner: ownerId ?? undefined }));
    setNewName("");
    setNewUniversal(false);
  }

  const canEdit = (c: CasinoConfig) => isSuperAdmin || !c.owner || c.owner === ownerId;
  const universal = settings.casinos.filter(c => c.universal);
  const mine = settings.casinos.filter(c => !c.universal);

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-title">Casinos &amp; Games</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Add each casino you play. Every casino automatically offers <b>Traditional</b> baccarat
        (5% commission on a Banker win, no side bets). To play a Tiger, Dragon or any side-bet
        game, add it as a variant and choose its commission and side bets — it then appears as a
        game option in Live Session.
        {isSuperAdmin && " As super admin, mark a casino Universal to publish it to every account."}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 8, maxWidth: 520, flexWrap: "wrap" }}>
        <input className="input" placeholder="Casino name (e.g. Crown Melbourne)" style={{ flex: 1, minWidth: 200 }}
          value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addCasino()} />
        <button className="btn btn-secondary" onClick={addCasino} disabled={!newName.trim()}>+ Add casino</button>
      </div>
      {isSuperAdmin && (
        <label className="flex items-center gap-8" style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, cursor: "pointer" }}>
          <input type="checkbox" checked={newUniversal} onChange={e => setNewUniversal(e.target.checked)} style={{ accentColor: "var(--gold)" }} />
          Publish to all users (Universal)
        </label>
      )}

      {universal.length > 0 && (
        <>
          <div className="field-label" style={{ marginTop: 4 }}>Universal casinos {isSuperAdmin ? "(shown to everyone)" : "(shared with you)"}</div>
          {universal.map(c => (
            <CasinoCard key={c.id} casino={c} defaults={settings.defaults}
              canEdit={canEdit(c)} canSetUniversal={isSuperAdmin}
              onChange={onUpsert} onRemove={() => onRemove(c.id)} />
          ))}
        </>
      )}

      <div className="field-label" style={{ marginTop: universal.length ? 12 : 4 }}>My casinos</div>
      {mine.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          No casinos of your own yet — add one above. Sessions with no matching casino use the default odds below.
        </div>
      )}
      {mine.map(c => (
        <CasinoCard key={c.id} casino={c} defaults={settings.defaults}
          canEdit={canEdit(c)} canSetUniversal={isSuperAdmin}
          onChange={onUpsert} onRemove={() => onRemove(c.id)} />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { isSuperAdmin, userId } = useAuth();
  const [settings, setSettings] = useState<PayoutSettings>(() => loadPayoutSettings());
  const [savedFlash, setSavedFlash] = useState(false);

  function flash() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }
  function handleUpsert(c: CasinoConfig) { upsertCasino(c); setSettings(loadPayoutSettings()); flash(); }
  function handleRemove(id: string) { removeCasino(id); setSettings(loadPayoutSettings()); flash(); }
  function handleDefaults(defaults: PayoutTable) { saveDefaults(defaults); setSettings(loadPayoutSettings()); flash(); }

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-12">
        <div className="page-title" style={{ marginBottom: 0, border: "none", paddingBottom: 0 }}>Settings</div>
        {savedFlash && <span style={{ fontSize: 12, color: "var(--tie-green)", fontWeight: 600 }}>✓ Saved</span>}
      </div>

      <AccountCard />

      <CasinoManager
        settings={settings}
        ownerId={userId}
        isSuperAdmin={isSuperAdmin}
        onUpsert={handleUpsert}
        onRemove={handleRemove}
      />

      <div className="panel">
        <div className="panel-title">Default Odds</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Used for any session whose casino and game type aren't configured above.
          Odds are profit per unit staked — a winning bet also returns its stake.
        </div>
        <PayoutEditor table={settings.defaults} onChange={handleDefaults} />
        <button className="btn btn-ghost" style={{ marginTop: 10, fontSize: 12 }}
          onClick={() => handleDefaults({ ...DEFAULT_PAYOUTS })}>
          Reset to market defaults
        </button>
      </div>
    </div>
  );
}
