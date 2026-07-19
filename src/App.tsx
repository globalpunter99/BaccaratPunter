import { useState } from "react";
import "./index.css";
import LiveSession from "./components/session/LiveSession";
import SessionLibrary from "./components/library/SessionLibrary";
import UploadSession from "./components/library/UploadSession";
import ProfileHub from "./components/profile/ProfileHub";
import StatsLeaderboard from "./components/stats/StatsLeaderboard";
import Guide from "./components/guide/Guide";
import SettingsPage from "./components/settings/SettingsPage";
import UserManagement from "./components/admin/UserManagement";
import LoginPage from "./components/auth/LoginPage";
import { AuthProvider, useAuth } from "./lib/auth";

type Tab =
  | "live"
  | "library"
  | "upload"
  | "profile"
  | "stats"
  | "guide"
  | "settings"
  | "users";

const NAV: { id: Tab; label: string; group: string }[] = [
  { id: "live",            label: "Live Session",   group: "Session" },
  { id: "library",         label: "Session Library", group: "Data" },
  { id: "upload",          label: "Upload Session",  group: "Data" },
  { id: "profile",         label: "Profile",         group: "Profile" },
  { id: "stats",           label: "Stats",           group: "Profile" },
  { id: "guide",           label: "Guide",           group: "Help" },
  { id: "settings",        label: "Settings",        group: "Help" },
];

function AppShell() {
  const { loading, userId, localMode, isSuperAdmin, profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("live");

  // Cloud mode: wait for the session check, then gate behind sign-in.
  if (!localMode) {
    if (loading) {
      return (
        <div className="app-shell" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>
        </div>
      );
    }
    if (!userId) return <LoginPage />;
  }

  const nav: typeof NAV = isSuperAdmin
    ? [...NAV, { id: "users", label: "Users", group: "Admin" }]
    : NAV;

  function renderTab() {
    switch (tab) {
      case "live":            return <LiveSession />;
      case "library":         return <SessionLibrary />;
      case "upload":          return <UploadSession />;
      case "profile":         return <ProfileHub />;
      case "stats":           return <StatsLeaderboard />;
      case "guide":           return <Guide />;
      case "settings":        return <SettingsPage />;
      case "users":           return isSuperAdmin ? <UserManagement /> : <LiveSession />;
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-logo">
          BaccaratPunter
          <span>v0.1 prototype</span>
        </div>
        <nav className="nav-tabs">
          {nav.map(n => (
            <button
              key={n.id}
              className={`nav-tab${tab === n.id ? " active" : ""}`}
              onClick={() => setTab(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
        {!localMode && userId && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", flexShrink: 0 }}>
            <span className="header-user-name" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {profile?.username || profile?.email}
              {isSuperAdmin && <span style={{ color: "var(--gold)" }}> · super admin</span>}
            </span>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 12px" }} onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="app-content">
        {renderTab()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
