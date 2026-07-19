import { useState } from "react";
import "./index.css";
import LiveSession from "./components/session/LiveSession";
import SessionLibrary from "./components/library/SessionLibrary";
import UploadSession from "./components/library/UploadSession";
import ProfileHub from "./components/profile/ProfileHub";
import StatsLeaderboard from "./components/stats/StatsLeaderboard";
import Guide from "./components/guide/Guide";
import SettingsPage from "./components/settings/SettingsPage";

type Tab =
  | "live"
  | "library"
  | "upload"
  | "profile"
  | "stats"
  | "guide"
  | "settings";

const NAV: { id: Tab; label: string; group: string }[] = [
  { id: "live",            label: "Live Session",   group: "Session" },
  { id: "library",         label: "Session Library", group: "Data" },
  { id: "upload",          label: "Upload Session",  group: "Data" },
  { id: "profile",         label: "Profile",         group: "Profile" },
  { id: "stats",           label: "Stats",           group: "Profile" },
  { id: "guide",           label: "Guide",           group: "Help" },
  { id: "settings",        label: "Settings",        group: "Help" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("live");

  function renderTab() {
    switch (tab) {
      case "live":            return <LiveSession />;
      case "library":         return <SessionLibrary />;
      case "upload":          return <UploadSession />;
      case "profile":         return <ProfileHub />;
      case "stats":           return <StatsLeaderboard />;
      case "guide":           return <Guide />;
      case "settings":        return <SettingsPage />;
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
          {NAV.map(n => (
            <button
              key={n.id}
              className={`nav-tab${tab === n.id ? " active" : ""}`}
              onClick={() => setTab(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-content">
        {renderTab()}
      </main>
    </div>
  );
}
