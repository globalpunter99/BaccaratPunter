import { useRef, useState } from "react";
import type { Outcome } from "../../game/baccarat";
import type { BeadCell, ExtractSuccess } from "../../game/beadExtract";
import { extractFromFile } from "../../lib/beadPhoto";
import { addUploadedSession } from "../../lib/sessionStore";
import RoadsDisplay from "../roads/RoadsDisplay";

type Step = "upload" | "review" | "done";

const BEAD_ROWS = 6;
const BEAD_MIN_COLS = 15;

// Extracted results shown as a corrected-in-place bead plate:
// 6 rows deep, filled top-to-bottom then left-to-right, click to cycle B→P→T.
// A "?" cell is one the detector located but couldn't read — it's drawn as an
// empty amber ring and must be set by the user before the shoe can be saved.
function ExtractedBeadPlate({
  results, onCycle, imageUrl,
}: { results: BeadCell[]; onCycle: (idx: number) => void; imageUrl: string | null }) {
  const cols = Math.max(Math.ceil(results.length / BEAD_ROWS), BEAD_MIN_COLS);
  const cellSize = 34;
  const banker = results.filter(r => r === "B").length;
  const player = results.filter(r => r === "P").length;
  const tie = results.filter(r => r === "T").length;
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // degrees, 90° steps

  // Drag-to-pan: dragging inside the frame scrolls it, so the user can
  // move the photo around and choose what to focus on.
  const frameRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);

  function panStart(e: React.PointerEvent) {
    const frame = frameRef.current;
    if (!frame) return;
    dragState.current = { x: e.clientX, y: e.clientY, sl: frame.scrollLeft, st: frame.scrollTop };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function panMove(e: React.PointerEvent) {
    const frame = frameRef.current;
    const d = dragState.current;
    if (!frame || !d) return;
    frame.scrollLeft = d.sl - (e.clientX - d.x);
    frame.scrollTop = d.st - (e.clientY - d.y);
  }
  function panEnd() {
    dragState.current = null;
  }

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
          <div style={{ overflowX: "auto", flexShrink: 1, minWidth: 0 }}>
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
                // Unread cells are always clickable — they have to be resolved
                // before the shoe can be saved, edit mode or not.
                const clickable = !!r && (editing || r === "?");
                return (
                  <div
                    key={idx}
                    className="road-cell"
                    style={clickable ? { cursor: "pointer" } : undefined}
                    title={clickable ? `Hand ${handIdx + 1} — click to correct` : undefined}
                    onClick={clickable ? () => onCycle(handIdx) : undefined}
                  >
                    {r === "?" ? (
                      <div
                        className="road-stone unread"
                        style={{ width: cellSize * 0.72, height: cellSize * 0.72 }}
                        title="Couldn't be read — click to set"
                      >
                        ?
                      </div>
                    ) : r ? (
                      <div
                        className={`road-stone ${r === "B" ? "banker" : r === "P" ? "player" : "tie"}`}
                        style={{ width: cellSize * 0.72, height: cellSize * 0.72 }}
                      >
                        {r}
                      </div>
                    ) : null}
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
                    title="Rotate left 90°"
                    onClick={() => setRotation(r => (r + 270) % 360)}>⟲</button>
                  <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: 13 }}
                    title="Rotate right 90°"
                    onClick={() => setRotation(r => (r + 90) % 360)}>⟳</button>
                  <span style={{ width: 10 }} />
                  <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: 13 }}
                    onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}>−</button>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 42, textAlign: "center" }}>
                    {Math.round(zoom * 100)}%
                  </span>
                  <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: 13 }}
                    onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}>+</button>
                </div>
                <div
                  ref={frameRef}
                  className="photo-viewer-frame pannable"
                  onPointerDown={panStart}
                  onPointerMove={panMove}
                  onPointerUp={panEnd}
                  onPointerLeave={panEnd}
                >
                  <img
                    src={imageUrl}
                    alt="Uploaded bead plate"
                    draggable={false}
                    style={{
                      width: `${zoom * 100}%`,
                      display: "block",
                      transform: `rotate(${rotation}deg)`,
                      transformOrigin: "center center",
                    }}
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<BeadCell[]>([]);
  const [report, setReport] = useState<Omit<ExtractSuccess, "results"> | null>(null);
  const [failure, setFailure] = useState<{ reason: string; detail: string } | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [previewAll, setPreviewAll] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // "?" cells have no outcome yet, so they're held back from the roads preview.
  const extractedOutcomes: Outcome[] = extracted
    .filter((r): r is "B" | "P" | "T" => r !== "?")
    .map(r => (r === "B" ? "banker" : r === "P" ? "player" : "tie"));
  const unresolved = extracted.filter(r => r === "?").length;

  function cycleResult(idx: number) {
    const NEXT: Record<BeadCell, BeadCell> = { "?": "B", B: "P", P: "T", T: "B" };
    setExtracted(prev => prev.map((r, i) => (i === idx ? NEXT[r] : r)));
  }

  function handleFile(file: File) {
    setImageFile(file);
    setImageName(file.name);
    setFailure(null);
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

  async function processImage() {
    if (!imageFile) return;
    setAnalysing(true);
    setFailure(null);
    try {
      const res = await extractFromFile(imageFile);
      if (!res.ok) {
        // No fallback, no invented shoe: an unreadable photo is reported as
        // unreadable so the user retakes it.
        setFailure({ reason: res.reason, detail: res.detail });
        return;
      }
      const { results, ...rest } = res;
      setExtracted(results);
      setReport(rest);
      setStep("review");
    } finally {
      setAnalysing(false);
    }
  }

  function saveSession() {
    if (unresolved > 0) return;
    const saved = addUploadedSession({
      date: sessionDate || new Date().toISOString().slice(0, 10),
      venue: venue.trim() || "Not set",
      tableNumber: tableNum.trim() || "Not set",
      type: "extra",
      hands: extractedOutcomes.map((outcome, i) => ({
        id: i + 1,
        outcome,
        bankerPair: false,
        playerPair: false,
        natural: false,
      })),
      notes: notes.trim() || "Extracted from a bead plate photo.",
    });
    setSessionId(saved.id);
    setStep("done");
  }

  function startNew() {
    setStep("upload");
    setVenue("");
    setTableNum("");
    setSessionDate("");
    setNotes("");
    setImageFile(null);
    setImageName(null);
    setExtracted([]);
    setReport(null);
    setFailure(null);
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

        <div className="upload-grid">
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

            {report && (
              <div className="panel" style={{ fontSize: 12 }}>
                <div className="panel-title">Extraction</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "var(--text-muted)" }}>Confidence</span>
                  <b style={{ color: report.confidence >= 0.85 ? "var(--signal-green)" : "var(--gold)" }}>
                    {Math.round(report.confidence * 100)}%
                  </b>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ color: "var(--text-muted)" }}>Grid read</span>
                  <b>{report.rows} rows × {report.cols} cols</b>
                </div>
                {report.warnings.map((w, i) => (
                  <div key={i} style={{ color: "var(--gold)", lineHeight: 1.5, marginTop: 6 }}>⚠ {w}</div>
                ))}
              </div>
            )}

            {unresolved > 0 && (
              <div className="panel" style={{ fontSize: 12, color: "var(--gold)", borderColor: "var(--gold)" }}>
                {unresolved} cell{unresolved > 1 ? "s" : ""} still marked <b>?</b>. Click each one on
                the grid to set it before saving.
              </div>
            )}

            <button
              className="btn btn-gold"
              onClick={saveSession}
              disabled={unresolved > 0}
              style={{ opacity: unresolved > 0 ? 0.4 : 1 }}
            >
              Save to Library
            </button>
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

      {failure && (
        <div
          className="panel mb-16"
          style={{ borderColor: "var(--banker-red)", fontSize: 13 }}
        >
          <div style={{ color: "var(--banker-red)", fontWeight: 700, marginBottom: 6 }}>
            ✕ {failure.reason}
          </div>
          <div style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {failure.detail}
          </div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 10 }}>
            Nothing was extracted — this photo can't be used. Take another one and try again,
            or record the shoe by hand in Live Session.
          </div>
        </div>
      )}

      <div className="panel mb-16" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        <div className="panel-title">Tips for best results</div>
        <ul style={{ paddingLeft: 16, lineHeight: 2 }}>
          <li>Hold the phone parallel to the screen — avoid angles</li>
          <li>Frame the bead plate only, not the whole board</li>
          <li>Make sure all columns of the bead plate are visible</li>
          <li>Good lighting, no glare on the casino screen</li>
          <li>You can correct any misread cells before saving</li>
        </ul>
      </div>

      <button
        className="btn btn-gold"
        disabled={!imageName || analysing}
        onClick={processImage}
        style={{ opacity: imageName && !analysing ? 1 : 0.4 }}
      >
        {analysing ? "Reading photo…" : "Extract Results →"}
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
