import { useEffect, useRef, useState } from "react";
import "./index.css";
import LiveSession from "./components/session/LiveSession";
import SessionLibrary from "./components/library/SessionLibrary";
import UploadSession from "./components/library/UploadSession";
import ProfileHub from "./components/profile/ProfileHub";
import StatsLeaderboard from "./components/stats/StatsLeaderboard";
import Guide from "./components/guide/Guide";
import SettingsPage from "./components/settings/SettingsPage";
import FeedbackPage from "./components/feedback/FeedbackPage";
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
  | "feedback"
  | "users";

const NAV: { id: Tab; label: string; group: string }[] = [
  { id: "live",            label: "Live Session",   group: "Session" },
  { id: "library",         label: "Session Library", group: "Data" },
  { id: "upload",          label: "Upload Session",  group: "Data" },
  { id: "profile",         label: "Profile",         group: "Profile" },
  { id: "stats",           label: "Stats",           group: "Profile" },
  { id: "guide",           label: "Guide",           group: "Help" },
  { id: "settings",        label: "Settings",        group: "Help" },
  { id: "feedback",        label: "Feedback",        group: "Help" },
];

/** True while the viewport is narrower than `px` — drives the phone nav menu. */
function useNarrow(px: number): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(`(max-width: ${px}px)`).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${px}px)`);
    const sync = () => setNarrow(mq.matches);
    sync();
    // `change` alone is enough in a normal browser, but some embedded views
    // resize without firing it — `resize` is the reliable backstop.
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [px]);
  return narrow;
}

// Phone nav: the tab strip overflows below ~700px, so it collapses into a
// single labelled button that drops the full list down.
function NavMenu({
  nav, tab, onPick,
}: { nav: typeof NAV; tab: Tab; onPick: (t: Tab) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = nav.find(n => n.id === tab);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="nav-menu" ref={ref}>
      <button
        className="nav-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="nav-menu-bars">☰</span>
        <span className="nav-menu-label">{current?.label ?? "Menu"}</span>
        <span className="nav-menu-caret">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="nav-menu-list" role="menu">
          {nav.map(n => (
            <button
              key={n.id}
              role="menuitem"
              className={`nav-menu-item${tab === n.id ? " active" : ""}`}
              onClick={() => { onPick(n.id); setOpen(false); }}
            >
              {n.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AppShell() {
  const {
    loading, userId, localMode, isSuperAdmin, profile, signOut,
    actingProfile, stopViewingUser,
  } = useAuth();
  const [tab, setTab] = useState<Tab>("live");
  const narrow = useNarrow(700);

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
      case "feedback":        return <FeedbackPage />;
      case "users":           return isSuperAdmin ? <UserManagement /> : <LiveSession />;
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        {/* Inner track shares the page's max-width and padding, so the logo
            lines up with the left edge of the Big Road and the account block
            with its right edge, instead of running to the window edges. */}
        <div className="app-header-inner">
        <div className="app-logo">
          BaccaratPunter
          <span>v0.1 prototype</span>
        </div>
        {narrow ? (
          <NavMenu nav={nav} tab={tab} onPick={setTab} />
        ) : (
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
        )}
        {!localMode && userId && (
          <div className="header-account">
            <span className="header-user-name">
              {profile?.username || profile?.email}
              {isSuperAdmin && <span style={{ color: "var(--gold)" }}> · super admin</span>}
            </span>
            <button className="btn btn-ghost header-signout" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
        </div>
      </header>
      {/* Viewing someone else's account is a state you must never be in by
          accident: the banner is always on screen, names the account, and
          carries the way out. */}
      {actingProfile && (
        <div className="acting-banner">
          <span className="acting-banner-dot" />
          <span>
            Viewing <b>{actingProfile.username || actingProfile.email}</b>'s data —
            sessions, bets, profile and settings below are theirs, and changes save to their account.
          </span>
          <button className="btn btn-ghost acting-banner-exit" onClick={stopViewingUser}>
            Back to my account
          </button>
        </div>
      )}
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
