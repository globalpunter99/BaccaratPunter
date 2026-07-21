// User management (super admin only). Lists every profile; the admin can
// promote/demote between user and admin, and activate/disable accounts.
// Disabling blocks ALL of that user's data access at the RLS layer.
//
// Full auth-user deletion needs the service-role key, which never ships in
// client code — do that from the Supabase dashboard (Authentication > Users);
// the profile row and all data cascade-delete with the auth user.

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth, type Profile } from "../../lib/auth";

export default function UserManagement() {
  const { profile: me, viewAsUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Deletion is irreversible and cascades every session, bet and photo the
  // account owns, so it is gated behind typing the account's name.
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function refresh() {
    if (!supabase) return;
    setLoading(true);
    const { data, error: err } = await supabase
      .from("profiles").select("*").order("created_at", { ascending: true });
    if (err) setError(err.message);
    else setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function update(id: string, patch: Partial<Pick<Profile, "role" | "status">>) {
    if (!supabase) return;
    setBusyId(id);
    setError(null);
    const { error: err } = await supabase.from("profiles").update(patch).eq("id", id);
    if (err) setError(err.message);
    await refresh();
    setBusyId(null);
  }

  /** The word the admin must type to arm the Delete button. */
  const confirmWord = (u: Profile) => u.username || u.email;

  async function confirmDelete() {
    if (!supabase || !deleteTarget) return;
    setDeleting(true);
    setError(null);
    const { error: err } = await supabase.rpc("delete_user", { target_id: deleteTarget.id });
    setDeleting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDeleteTarget(null);
    setConfirmText("");
    await refresh();
  }

  const roleLabel: Record<Profile["role"], string> = {
    super_admin: "Super Admin", admin: "Admin", user: "User",
  };

  return (
    <div className="page">
      <div className="page-title">User Management</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
        <b>View data</b> opens that account — its library, bets, profile and settings —
        and anything you change there saves to their account. <b>Disable</b> blocks all
        access and data immediately and is reversible. <b>Delete</b> is permanent: it
        removes the sign-in, every recorded session and bet, and all screen photos,
        with no way back.
      </div>

      {error && (
        <div style={{
          marginBottom: 12, padding: "8px 12px", borderRadius: "var(--radius-sm)",
          fontSize: 12, background: "rgba(220,60,60,0.12)",
          border: "1px solid var(--banker-red)", color: "var(--text-secondary)",
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading users…</div>
      ) : (
        <div className="panel table-scroll" style={{ padding: 0 }}>
          <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-dark)", textAlign: "left" }}>
                {["Username", "Email", "Role", "Status", "Joined", "Actions"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isSelf = u.id === me?.id;
                const isSuper = u.role === "super_admin";
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--border-panel)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                      {u.username || "—"}{isSelf && <span style={{ color: "var(--gold)", fontSize: 11 }}> (you)</span>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{u.email}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 3,
                        background: isSuper ? "rgba(245,200,66,0.15)" : u.role === "admin" ? "rgba(58,232,232,0.12)" : "var(--bg-dark)",
                        color: isSuper ? "var(--gold)" : u.role === "admin" ? "#3ae8e8" : "var(--text-secondary)",
                      }}>
                        {roleLabel[u.role]}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ color: u.status === "active" ? "var(--tie-green)" : "var(--banker-red)", fontWeight: 600, fontSize: 12 }}>
                        {u.status === "active" ? "● Active" : "● Disabled"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: 12 }}>
                      {u.created_at?.slice(0, 10)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {!isSelf && (
                          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px", color: "var(--gold)" }}
                            title={`Open ${u.username || u.email}'s library, profile and settings`}
                            onClick={() => viewAsUser(u.id)}>
                            View data
                          </button>
                        )}
                        {isSuper ? (
                          <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>protected</span>
                        ) : (
                          <>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} disabled={busy}
                              onClick={() => update(u.id, { role: u.role === "admin" ? "user" : "admin" })}>
                              {u.role === "admin" ? "Demote to user" : "Make admin"}
                            </button>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px", color: u.status === "active" ? "var(--banker-red)" : "var(--tie-green)" }} disabled={busy}
                              onClick={() => update(u.id, { status: u.status === "active" ? "disabled" : "active" })}>
                              {u.status === "active" ? "Disable" : "Re-activate"}
                            </button>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px", color: "var(--banker-red)" }} disabled={busy}
                              title="Permanently delete this account and all its data"
                              onClick={() => { setDeleteTarget(u); setConfirmText(""); setError(null); }}>
                              🗑 Delete
                            </button>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation — the account's name must be typed to arm it */}
      {deleteTarget && (
        <div className="info-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="info-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: "var(--banker-red)" }}>
              Delete this account permanently?
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
              <b style={{ color: "var(--text-primary)" }}>{deleteTarget.username || "—"}</b>
              {" "}({deleteTarget.email}) will be removed along with every session,
              bet and screen photo on the account. They will not be able to sign in
              again. <b>This cannot be undone.</b>
            </div>
            <label className="field-col" style={{ marginBottom: 14 }}>
              <span className="field-label">
                Type <b style={{ color: "var(--gold)" }}>{confirmWord(deleteTarget)}</b> to confirm
              </span>
              <input
                className="input"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={confirmWord(deleteTarget)}
                autoFocus
              />
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" disabled={deleting}
                onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: "var(--banker-red)", color: "#fff" }}
                disabled={deleting || confirmText.trim() !== confirmWord(deleteTarget)}
                onClick={confirmDelete}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
