import { useState } from "react";
import type { Outcome } from "../../game/baccarat";
import RoadsDisplay from "../roads/RoadsDisplay";

type Step = "upload" | "review" | "done";

const DEMO_EXTRACTED = [
  "B","B","P","B","B","P","P","B","T","B",
  "P","P","P","B","B","B","P","P","B","P",
  "B","B","P","P","P","B","B","B","P","P",
];

const BEAD_ROWS = 6;
const BEAD_MIN_COLS = 15;

// Extracted results shown as a corrected-in-place bead plate:
// 6 rows deep, filled top-to-bottom then left-to-right, click to cycle B→P→T.
function ExtractedBeadPlate({
  results, onCycle, imageUrl,
}: { results: string[]; onCycle: (idx: number) => void; imageUrl: string | null }) {
  const cols = Math.max(Math.ceil(results.length / BEAD_ROWS), BEAD_MIN_COLS);
  const cellSize = 34;
  const banker = results.filter(r => r === "B").length;
  const player = results.filter(r => r === "P").length;
  const tie = results.filter(r => r === "T").length;
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(1);

  return (
    <div>
      <div className="road-section">
        <div className="road-section-header align-left">
          <span className="road-title-block">
            <span className="road-section-title-en">Bead Plate</span>
            <span className="road-section-title-sep">/</span>
            <span className="road-section-title-cn">珠盘路</span>
          </span>
          <span className="header-stats">
            <span style={{ display: "flex", gap: 14 }}>
              <span className="header-stat"><span className="header-stat-label">Game</span> <span className="stats-value games" style={{ fontSize: 13 }}>{results.length}</span></span>
              <span className="header-stat"><span className="header-stat-label">Banker</span> <span className="stats-value banker" style={{ fontSize: 13 }}>{banker}</span></span>
              <span className="header-stat"><span className="header-stat-label">Player</span> <span className="stats-value player" style={{ fontSize: 13 }}>{player}</span></span>
              <span className="header-stat"><span className="header-stat-label">Tie</span> <span className="stats-value tie" style={{ fontSize: 13 }}>{tie}</span></span>
            </span>
          </span>
          <button
            className="bead-edit-btn"
            data-editing={editing || undefined}
            onClick={() => setEditing(p => !p)}
          >
            {editing ? "💾 Save" : "✎ Edit"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ overflowX: "auto", flexShrink: 0 }}>
            <div
              className="road-grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
                gridTemplateRows: `repeat(${BEAD_ROWS}, ${cellSize}px)`,
                width: cols * cellSize,
              }}
            >
              {Array.from({ length: BEAD_ROWS * cols }).map((_, idx) => {
                const row = Math.floor(idx / cols);
                const col = idx % cols;
                const handIdx = col * BEAD_ROWS + row;
                const r = handIdx < results.length ? results[handIdx] : null;
                const clickable = !!r && editing;
                return (
                  <div
                    key={idx}
                    className="road-cell"
                    style={clickable ? { cursor: "pointer" } : undefined}
                    title={clickable ? `Hand ${handIdx + 1} — click to correct` : undefined}
                    onClick={clickable ? () => onCycle(handIdx) : undefined}
                  >
                    {r && (
                      <div
                        className={`road-stone ${r === "B" ? "banker" : r === "P" ? "player" : "tie"}`}
                        style={{ width: cellSize * 0.72, height: cellSize * 0.72 }}
                      >
                        {r}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Original photo viewer with zoom, for side-by-side comparison */}
          <div className="photo-viewer">
            {imageUrl ? (
              <>
                <div className="photo-viewer-controls">
                  <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: 13 }}
                    onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}>−</button>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 42, textAlign: "center" }}>
                    {Math.round(zoom * 100)}%
                  </span>
                  <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: 13 }}
                    onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}>+</button>
                </div>
                <div className="photo-viewer-frame">
                  <img
                    src={imageUrl}
                    alt="Uploaded bead plate"
                    style={{ width: `${zoom * 100}%`, display: "block" }}
                  />
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
                Uploaded photo appears here for comparison
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary counts below */}
      <div className="stats-panel" style={{ marginTop: 10, flexDirection: "row", gap: 28, flexWrap: "wrap" }}>
        <div className="stats-row"><span className="stats-label">局数 Games</span><span className="stats-value games">{results.length}</span></div>
        <div className="stats-row"><span className="stats-label"><span className="stats-dot banker-dot">庄</span>Banker</span><span className="stats-value banker">{banker}</span></div>
        <div className="stats-row"><span className="stats-label"><span className="stats-dot player-dot">闲</span>Player</span><span className="stats-value player">{player}</span></div>
        <div className="stats-row"><span className="stats-label"><span className="stats-dot tie-dot">和</span>Tie</span><span className="stats-value tie">{tie}</span></div>
      </div>
    </div>
  );
}

export default function UploadSession() {
  const [step, setStep] = useState<Step>("upload");
  const [venue, setVenue] = useState("");
  const [tableNum, setTableNum] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<string[]>(DEMO_EXTRACTED);
  const [previewAll, setPreviewAll] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const extractedOutcomes: Outcome[] = extracted.map(r =>
    r === "B" ? "banker" : r === "P" ? "player" : "tie",
  );

  function cycleResult(idx: number) {
    const NEXT: Record<string, string> = { B: "P", P: "T", T: "B" };
    setExtracted(prev => prev.map((r, i) => (i === idx ? NEXT[r] : r)));
  }

  function handleFile(file: File) {
    setImageName(file.name);
    setImageUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function processImage() {
    setStep("review");
  }

  function saveSession() {
    // Backend pass will return the real ID; prototype generates one
    setSessionId(`EX-${String(Date.now()).slice(-6)}`);
    setStep("done");
  }

  function startNew() {
    setStep("upload");
    setVenue("");
    setTableNum("");
    setSessionDate("");
    setNotes("");
    setImageName(null);
    setImageUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSessionId(null);
  }

  if (step === "done") {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-title">Upload Session</div>
        <div className="panel" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--gold)", marginBottom: 8 }}>
            Session Saved to Library
          </div>
          <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 24 }}>
            {extracted.length} hands extracted and added to your session library
            {sessionId ? <> as <b style={{ color: "var(--gold)" }}>{sessionId}</b></> : null}.
            The shoe is now available for analysis, profiling, and practice play.
          </div>
          <div className="flex gap-8" style={{ justifyContent: "center" }}>
            <button className="btn btn-gold" onClick={startNew}>Upload Another</button>
            <button className="btn btn-secondary">View in Library</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="page">
        <div className="flex items-center justify-between mb-12">
          <div className="page-title">Review Extracted Results</div>
          <button className="btn btn-ghost" onClick={() => setStep("upload")}>← Back</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14 }}>
          {/* Left column — session details, like Live Session */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="panel">
              <div className="panel-title">Session Details</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Session ID</label>
                  <input
                    readOnly
                    value={sessionId ?? "Not Yet Saved"}
                    style={{ ...inputStyle, color: sessionId ? "var(--gold)" : "var(--text-muted)", cursor: "default" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Venue</label>
                  <input value={venue} onChange={e => setVenue(e.target.value)}
                    placeholder="e.g. Crown Melbourne" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Table Number</label>
                  <input value={tableNum} onChange={e => setTableNum(e.target.value)}
                    placeholder="e.g. Table 7" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={sessionDate}
                    onChange={e => setSessionDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Notes (optional)</label>
                  <input value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Any observations..." style={inputStyle} />
                </div>
              </div>
            </div>

            <button className="btn btn-gold" onClick={saveSession}>Save to Library</button>
            <button className="btn btn-secondary" onClick={() => setStep("upload")}>Re-upload</button>
          </div>

          {/* Right column — extracted results */}
          <div className="panel">
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <div className="panel-title" style={{ marginBottom: 0 }}>
                Extracted from image — {extracted.length} hands
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={() => setPreviewAll(p => !p)}
              >
                {previewAll ? "← Back to Bead Plate" : "Preview All Screens"}
              </button>
            </div>
            {previewAll ? (
              <>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                  Full Macau screens derived from the extracted results — compare against
                  any photos or screenshots you took at the table.
                </div>
                <RoadsDisplay
                  outcomes={extractedOutcomes}
                  betsToggle={false}
                  onCycleOutcome={cycleResult}
                />
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                  Check the grid against your photo on the right. Press ✎ Edit to make
                  corrections — clicking a result cycles B → P → T — then 💾 Save.
                </div>
                <ExtractedBeadPlate results={extracted} onCycle={cycleResult} imageUrl={imageUrl} />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 600 }}>
      <div className="page-title">Upload Session</div>
      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
        Add a baccarat shoe from a casino photo. Upload a picture of the bead plate screen —
        the program will extract the result sequence and add it to your session library.
        These extra sessions can be analysed against your player profile and used for practice play.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? "var(--border-accent)" : imageName ? "var(--signal-green)" : "var(--border-panel)"}`,
          borderRadius: "var(--radius-lg)",
          padding: 48,
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 0.2s",
          background: dragOver ? "rgba(42,171,184,0.05)" : "var(--bg-panel)",
          marginBottom: 16,
        }}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleInputChange}
        />
        {imageName ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🖼</div>
            <div style={{ color: "var(--signal-green)", fontWeight: 600 }}>{imageName}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              Click to replace
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📷</div>
            <div style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
              Drop a bead plate photo here
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
              or click to browse · JPG, PNG, HEIC
            </div>
          </>
        )}
      </div>

      <div className="panel mb-16" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        <div className="panel-title">Tips for best results</div>
        <ul style={{ paddingLeft: 16, lineHeight: 2 }}>
          <li>Hold the phone parallel to the screen — avoid angles</li>
          <li>Make sure all columns of the bead plate are visible</li>
          <li>Good lighting, no glare on the casino screen</li>
          <li>You can correct any misread cells before saving</li>
        </ul>
      </div>

      <button
        className="btn btn-gold"
        disabled={!imageName}
        onClick={processImage}
        style={{ opacity: imageName ? 1 : 0.4 }}
      >
        Extract Results →
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  display: "block",
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-dark)",
  border: "1px solid var(--border-panel)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 13,
  outline: "none",
};
