import { useState } from "react";
import "./index.css";
import LiveSession from "./components/session/LiveSession";
import SessionLibrary from "./components/library/SessionLibrary";
import UploadSession from "./components/library/UploadSession";
import PracticePlay from "./components/practice/PracticePlay";
import ProfileBuilder from "./components/profile/ProfileBuilder";
import ProfileComparison from "./components/profile/ProfileComparison";
import StatsLeaderboard from "./components/stats/StatsLeaderboard";
import ShoeReplay from "./components/replay/ShoeReplay";
import Guide from "./components/guide/Guide";
import SettingsPage from "./components/settings/SettingsPage";

type Tab =
  | "live"
  | "library"
  | "upload"
  | "practice"
  | "profile-build"
  | "profile-compare"
  | "stats"
  | "replay"
  | "guide"
  | "settings";

const NAV: { id: Tab; label: string; group: string }[] = [
  { id: "live",            label: "Live Session",   group: "Session" },
  { id: "library",         label: "Library",         group: "Data" },
  { id: "upload",          label: "Upload Session",  group: "Data" },
  { id: "practice",        label: "Practice Play",   group: "Data" },
  { id: "replay",          label: "Shoe Replay",     group: "Data" },
  { id: "profile-build",   label: "Build Profile",   group: "Profile" },
  { id: "profile-compare", label: "Profiles",        group: "Profile" },
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
      case "practice":        return <PracticePlay />;
      case "profile-build":   return <ProfileBuilder />;
      case "profile-compare": return <ProfileComparison />;
      case "stats":           return <StatsLeaderboard />;
      case "replay":          return <ShoeReplay />;
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
