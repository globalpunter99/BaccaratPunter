import { useState } from "react";

type Step = "upload" | "review" | "done";

const DEMO_EXTRACTED = [
  "B","B","P","B","B","P","P","B","T","B",
  "P","P","P","B","B","B","P","P","B","P",
  "B","B","P","P","P","B","B","B","P","P",
];

export default function UploadSession() {
  const [step, setStep] = useState<Step>("upload");
  const [venue, setVenue] = useState("");
  const [tableNum, setTableNum] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [imageName, setImageName] = useState<string | null>(null);

  function handleFile(name: string) {
    setImageName(name);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file.name);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file.name);
  }

  function processImage() {
    setStep("review");
  }

  function saveSession() {
    setStep("done");
  }

  function startNew() {
    setStep("upload");
    setVenue("");
    setTableNum("");
    setSessionDate("");
    setNotes("");
    setImageName(null);
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
            {DEMO_EXTRACTED.length} hands extracted and added to your session library.
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
      <div className="page" style={{ maxWidth: 700 }}>
        <div className="flex items-center justify-between mb-12">
          <div className="page-title">Review Extracted Results</div>
          <button className="btn btn-ghost" onClick={() => setStep("upload")}>← Back</button>
        </div>

        <div className="panel mb-12">
          <div className="panel-title">Extracted from image — {DEMO_EXTRACTED.length} hands</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            Check the sequence matches the bead plate. Click any result to correct it.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {DEMO_EXTRACTED.map((r, i) => (
              <span
                key={i}
                className={`badge ${r === "B" ? "badge-banker" : r === "P" ? "badge-player" : "badge-tie"}`}
                style={{ cursor: "pointer", fontSize: 12, padding: "4px 8px" }}
              >
                {i + 1}:{r}
              </span>
            ))}
          </div>
        </div>

        <div className="panel mb-12">
          <div className="panel-title">Session Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Venue
              </label>
              <input
                className="input-field"
                value={venue}
                onChange={e => setVenue(e.target.value)}
                placeholder="e.g. Crown Melbourne"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Table Number
              </label>
              <input
                className="input-field"
                value={tableNum}
                onChange={e => setTableNum(e.target.value)}
                placeholder="e.g. Table 7"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Date
              </label>
              <input
                type="date"
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                Notes (optional)
              </label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any observations..."
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          <button className="btn btn-gold" onClick={saveSession}>Save to Library</button>
          <button className="btn btn-secondary" onClick={() => setStep("upload")}>Re-upload</button>
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
