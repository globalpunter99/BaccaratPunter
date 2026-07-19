import { useEffect, useRef, useState } from "react";
import { addPhoto, listPhotos, removePhoto, MAX_PHOTOS, type ScreenPhoto } from "../../lib/photoStore";

// Screen photos: the camera control in the Big Road header plus its attach /
// view / delete modal. The icon colour tells the user the state at a glance —
// grey with a "+" when the screen has no photo (tap to attach), gold with a
// count when photos are stored (tap to view). Deleting is only offered where
// the caller allows it (the Library), per the product rule.

function CameraIcon({ filled }: { filled: boolean }) {
  const colour = filled ? "var(--gold)" : "var(--text-muted)";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" fill={filled ? "var(--gold)" : "none"} />
    </svg>
  );
}

export default function ScreenPhotos({ screenId, canDelete }: {
  screenId: string;
  canDelete?: boolean;
}) {
  const [photos, setPhotos] = useState<ScreenPhoto[]>([]);
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load (and re-load when the screen changes, e.g. a different library
  // session). Async: cloud mode lists + downloads from Supabase Storage.
  useEffect(() => {
    let cancelled = false;
    setPhotos([]);
    setOpen(false);
    setViewing(null);
    setError(null);
    listPhotos(screenId).then(p => { if (!cancelled) setPhotos(p); });
    return () => { cancelled = true; };
  }, [screenId]);

  async function reload() {
    setPhotos(await listPhotos(screenId));
  }

  const has = photos.length > 0;
  const full = photos.length >= MAX_PHOTOS;

  // ── Enlarged-photo viewer state (zoom / rotate / drag-pan) ──
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  function panStart(e: React.PointerEvent) {
    const frame = frameRef.current;
    if (!frame) return;
    drag.current = { x: e.clientX, y: e.clientY, sl: frame.scrollLeft, st: frame.scrollTop };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function panMove(e: React.PointerEvent) {
    const frame = frameRef.current;
    const d = drag.current;
    if (!frame || !d) return;
    frame.scrollLeft = d.sl - (e.clientX - d.x);
    frame.scrollTop = d.st - (e.clientY - d.y);
  }
  const panEnd = () => { drag.current = null; };
  function openViewer(i: number) { setViewing(i); setZoom(1); setRotation(0); }

  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || full) return;
    setBusy(true);
    setError(null);
    try {
      const res = await addPhoto(screenId, file);
      if (!res.ok) { setError(res.error ?? "Couldn't save the photo."); return; }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that photo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(i: number) {
    const target = photos[i];
    if (!target) return;
    setError(null);
    if (viewing === i) setViewing(null);
    else if (viewing != null && viewing > i) setViewing(viewing - 1);
    await removePhoto(screenId, target);
    await reload();
  }

  function close() { setOpen(false); setViewing(null); setError(null); }

  return (
    <>
      <button
        className="screen-photo-btn"
        data-has={has || undefined}
        title={has ? `View photos (${photos.length})` : "Attach a photo of this screen"}
        onClick={() => setOpen(true)}
      >
        <CameraIcon filled={has} />
        <span className="screen-photo-badge">{has ? photos.length : "+"}</span>
      </button>

      {open && (
        <div className="info-overlay" onClick={close}>
          <div className="info-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, width: "92%" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                Screen Photos <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>{photos.length}/{MAX_PHOTOS}</span>
              </div>
              <button className="info-close" onClick={close}>✕</button>
            </div>

            {error && (
              <div style={{
                fontSize: 12, color: "var(--banker-red)", background: "rgba(232,60,60,0.08)",
                border: "1px solid var(--banker-red)", borderRadius: "var(--radius-sm)",
                padding: "6px 10px", marginBottom: 10,
              }}>{error}</div>
            )}

            {viewing != null && photos[viewing] ? (
              // ── Enlarged single photo ──
              <div>
                <div className="photo-viewer-controls" style={{ justifyContent: "space-between" }}>
                  <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: 13 }} onClick={() => setViewing(null)}>← All</button>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: 13 }} title="Rotate left" onClick={() => setRotation(r => (r + 270) % 360)}>⟲</button>
                    <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: 13 }} title="Rotate right" onClick={() => setRotation(r => (r + 90) % 360)}>⟳</button>
                    <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: 13 }} onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}>−</button>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 42, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
                    <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: 13 }} onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}>+</button>
                  </span>
                  {canDelete
                    ? <button className="btn btn-ghost" style={{ padding: "2px 10px", fontSize: 13, color: "var(--banker-red)" }} onClick={() => remove(viewing)}>🗑 Delete</button>
                    : <span style={{ width: 60 }} />}
                </div>
                <div
                  ref={frameRef}
                  className="photo-viewer-frame pannable"
                  style={{ height: 420, border: "1px solid var(--border-panel)", borderRadius: "var(--radius-sm)" }}
                  onPointerDown={panStart} onPointerMove={panMove} onPointerUp={panEnd} onPointerLeave={panEnd}
                >
                  <img src={photos[viewing].url} alt="Screen photo" draggable={false}
                    style={{ width: `${zoom * 100}%`, display: "block", transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }} />
                </div>
              </div>
            ) : (
              // ── Grid of slots ──
              <>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {photos.map((p, i) => (
                    <div key={p.name} className="photo-slot">
                      <img src={p.url} alt={`Screen photo ${i + 1}`} onClick={() => openViewer(i)} />
                      <div className="photo-slot-actions">
                        <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, padding: "4px 0" }} onClick={() => openViewer(i)}>View</button>
                        {canDelete && (
                          <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12, padding: "4px 0", color: "var(--banker-red)" }} onClick={() => remove(i)}>Delete</button>
                        )}
                      </div>
                    </div>
                  ))}

                  {!full && (
                    <button className="photo-slot photo-slot-add" onClick={() => fileInput.current?.click()} disabled={busy}>
                      <div style={{ fontSize: 26, lineHeight: 1 }}>＋</div>
                      <div style={{ fontSize: 12 }}>{busy ? "Adding…" : "Attach photo"}</div>
                    </button>
                  )}
                </div>

                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
                  Up to {MAX_PHOTOS} photos of this screen (casino board or play screen).
                  {canDelete
                    ? " Delete to free a slot and attach a different one."
                    : " Deleting photos is available in the Library."}
                </div>
              </>
            )}

            <input ref={fileInput} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
          </div>
        </div>
      )}
    </>
  );
}
