// Bead-plate extraction: read a photo of a casino bead plate screen and
// recover the result sequence.
//
// This is deliberately a *detector*, not a guesser. A bead plate has a very
// specific signature — a regular grid, at most 6 rows deep, of similarly
// sized red / blue / green discs filled column-major. The pipeline below
// looks for exactly that signature and reports failure the moment the photo
// doesn't clearly show one, because a plausible-looking wrong shoe is far
// worse for the user than "this photo can't be used".
//
// Pure and framework-free: it takes raw pixels, so it runs in the browser off
// a canvas and in tests off a synthetic buffer.

export type Bead = "B" | "P" | "T";
/** A cell the detector located but could not read — the user must resolve it. */
export type BeadCell = Bead | "?";

export interface ImageLike {
  data: Uint8ClampedArray | number[];
  width: number;
  height: number;
}

export interface ExtractSuccess {
  ok: true;
  /** Column-major reading of the plate. May contain "?" for unreadable cells. */
  results: BeadCell[];
  rows: number;
  cols: number;
  /** 0-1. How cleanly the detected discs fit a regular grid. */
  confidence: number;
  /** Cells that need the user's eye (indices into `results`). */
  unresolved: number[];
  warnings: string[];
}

export interface ExtractFailure {
  ok: false;
  /** Short, user-facing reason the photo can't be used. */
  reason: string;
  /** One line of extra detail, safe to show under the reason. */
  detail: string;
}

export type ExtractResult = ExtractSuccess | ExtractFailure;

const ROWS_MAX = 6;
const MIN_BLOBS = 10;

// ── Colour classification ───────────────────────────────────────────────────
// Casino screens render Banker red, Player blue and Tie green at high
// saturation on a dark background, which survives phone photos and glare far
// better than any edge- or text-based approach would.

type Cls = 0 | 1 | 2 | 3; // 0 = background, 1 = red(B), 2 = blue(P), 3 = green(T)

function classify(r: number, g: number, b: number): Cls {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const v = max / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  // Washed-out or near-black pixels carry no reliable hue
  if (v < 0.18 || s < 0.3) return 0;

  const d = max - min;
  let h: number;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;

  if (h <= 22 || h >= 338) return 1;          // red
  if (h >= 185 && h <= 265) return 2;         // blue / cyan-blue
  if (h >= 80 && h <= 175) return 3;          // green
  return 0;
}

function classToBead(c: Cls): Bead {
  return c === 1 ? "B" : c === 2 ? "P" : "T";
}

// ── Connected components ────────────────────────────────────────────────────

interface Blob {
  cls: Cls;
  /** Centre of mass */
  cx: number; cy: number;
  /** Centre of the bounding box */
  bx: number; by: number;
  w: number; h: number;
  area: number;
}

function findBlobs(img: ImageLike): Blob[] {
  const { width: W, height: H, data } = img;
  const mask = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    mask[i] = classify(data[p], data[p + 1], data[p + 2]);
  }

  const seen = new Uint8Array(W * H);
  const blobs: Blob[] = [];
  const stack: number[] = [];

  for (let start = 0; start < W * H; start++) {
    const cls = mask[start] as Cls;
    if (cls === 0 || seen[start]) continue;

    seen[start] = 1;
    stack.length = 0;
    stack.push(start);
    let minX = W, maxX = 0, minY = H, maxY = 0, area = 0, sumX = 0, sumY = 0;

    while (stack.length) {
      const idx = stack.pop()!;
      const x = idx % W;
      const y = (idx - x) / W;
      area++; sumX += x; sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0 && !seen[idx - 1] && mask[idx - 1] === cls) { seen[idx - 1] = 1; stack.push(idx - 1); }
      if (x < W - 1 && !seen[idx + 1] && mask[idx + 1] === cls) { seen[idx + 1] = 1; stack.push(idx + 1); }
      if (y > 0 && !seen[idx - W] && mask[idx - W] === cls) { seen[idx - W] = 1; stack.push(idx - W); }
      if (y < H - 1 && !seen[idx + W] && mask[idx + W] === cls) { seen[idx + W] = 1; stack.push(idx + W); }
    }

    blobs.push({
      cls,
      cx: sumX / area, cy: sumY / area,
      bx: (minX + maxX) / 2, by: (minY + maxY) / 2,
      w: maxX - minX + 1, h: maxY - minY + 1,
      area,
    });
  }

  return blobs;
}

/**
 * Keep blobs that look like a bead marker rather than text, glare or a screen
 * edge.
 *
 * Casinos draw the bead plate either as solid discs or as hollow rings, and
 * both have to pass. A solid disc covers ~78% of its bounding box; a hollow
 * ring only ~25-40% depending on how thick the stroke is. So coverage alone
 * can't separate a marker from a glyph — what does is that a disc and a ring
 * are both *centred and square*: the centre of mass sits on the centre of the
 * bounding box. A letter, an arc or a stray highlight is lopsided.
 */
function markerLike(b: Blob, W: number, H: number): boolean {
  const long = Math.max(b.w, b.h);
  const short = Math.min(b.w, b.h);
  if (long < 6) return false;                          // noise / anti-aliasing
  if (long > Math.min(W, H) * 0.3) return false;       // a panel, not a bead
  if (short / long < 0.6) return false;                // slashes, bars, text

  const fill = b.area / (b.w * b.h);
  // Below ~0.15 is a hairline or an arc; 0.95+ is a filled rectangle.
  if (fill < 0.15 || fill > 0.95) return false;

  // Radially symmetric: centre of mass within a tenth of the box of its
  // geometric centre. True of both a filled disc and a ring, false of glyphs.
  return Math.abs(b.cx - b.bx) <= b.w * 0.12
      && Math.abs(b.cy - b.by) <= b.h * 0.12;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── Grid fitting ────────────────────────────────────────────────────────────
//
// The plate is found *inside* the photo rather than assumed to fill it. A
// photo of a table screen routinely catches more than the plate — the caption
// strip under it, a reflection, the roads above — and any of that would
// otherwise be taken for extra rows of the plate.

/**
 * Cell pitch. On a filled plate every marker's nearest neighbour is the cell
 * next to it, so the median nearest-neighbour distance is the pitch. Strays
 * are isolated, so they only ever sit in the tail of that distribution.
 */
function nearestNeighbourPitch(beads: Blob[]): number {
  const dists: number[] = [];
  for (const b of beads) {
    let best = Infinity;
    for (const o of beads) {
      if (o === b) continue;
      const d = Math.hypot(b.cx - o.cx, b.cy - o.cy);
      if (d < best) best = d;
    }
    if (Number.isFinite(best)) dists.push(best);
  }
  return median(dists);
}

/**
 * Where the lattice sits along one axis, as an offset in [0, pitch).
 *
 * Taking each position modulo the pitch turns a grid into a tight cluster of
 * angles around the circle, so the circular mean recovers the lattice offset.
 * Unlike chaining positions into clusters, one stray can't shift the answer —
 * it is a single vector against everything else.
 */
function latticePhase(values: number[], pitch: number): number {
  let sx = 0, sy = 0;
  for (const v of values) {
    const a = (2 * Math.PI * v) / pitch;
    sx += Math.cos(a); sy += Math.sin(a);
  }
  let a = Math.atan2(sy, sx);
  if (a < 0) a += 2 * Math.PI;
  return (a / (2 * Math.PI)) * pitch;
}

/** The run of consecutive column indices holding the most markers. */
function bestColumnRun(cols: number[]): { from: number; to: number } {
  const present = [...new Set(cols)].sort((a, b) => a - b);
  let from = present[0], to = present[0], best = -1;
  let i = 0;
  while (i < present.length) {
    let j = i;
    while (j + 1 < present.length && present[j + 1] === present[j] + 1) j++;
    const s = present[i], e = present[j];
    const n = cols.filter(c => c >= s && c <= e).length;
    if (n > best) { best = n; from = s; to = e; }
    i = j + 1;
  }
  return { from, to };
}

export function extractBeadPlate(img: ImageLike): ExtractResult {
  const { width: W, height: H } = img;
  if (W < 40 || H < 40) {
    return { ok: false, reason: "Photo too small", detail: "The image is too small to contain a readable bead plate." };
  }

  const all = findBlobs(img);
  let beads = all.filter(b => markerLike(b, W, H));

  if (beads.length < MIN_BLOBS) {
    return {
      ok: false,
      reason: "No bead plate found in this photo",
      detail: `Only ${beads.length} result markers could be made out. Retake the photo square-on to the bead plate screen, with the whole grid in frame and no glare.`,
    };
  }

  // A photo often catches the Big Road and derived roads too. Those markers
  // are drawn smaller than bead-plate discs, so keeping only blobs near the
  // dominant size isolates the plate.
  const sizes = beads.map(b => (b.w + b.h) / 2);
  const dom = median(sizes);
  beads = beads.filter(b => {
    const d = (b.w + b.h) / 2;
    return d >= dom * 0.65 && d <= dom * 1.5;
  });

  if (beads.length < MIN_BLOBS) {
    return {
      ok: false,
      reason: "No bead plate found in this photo",
      detail: "The result markers in this photo aren't a consistent size, so no bead plate grid could be identified. Retake the photo square-on to the bead plate screen.",
    };
  }

  const diameter = median(beads.map(b => (b.w + b.h) / 2));

  // Bead cells are square, so one pitch serves both axes.
  let pitch = nearestNeighbourPitch(beads);
  if (!(pitch > diameter * 0.7) || pitch > diameter * 2.5) pitch = diameter * 1.2;

  const phaseX = latticePhase(beads.map(b => b.cx), pitch);
  const phaseY = latticePhase(beads.map(b => b.cy), pitch);

  // Snap every marker to the lattice and measure how far off it sits.
  interface Snap { col: number; row: number; bead: Bead; err: number }
  const snapped: Snap[] = [];
  let misfits = 0;
  for (const b of beads) {
    const col = Math.round((b.cx - phaseX) / pitch);
    const row = Math.round((b.cy - phaseY) / pitch);
    const dx = Math.abs(b.cx - (phaseX + col * pitch)) / pitch;
    const dy = Math.abs(b.cy - (phaseY + row * pitch)) / pitch;
    // A marker more than a third of a cell off its gridline means the photo is
    // skewed or the "grid" isn't one.
    if (dx > 0.33 || dy > 0.33) { misfits++; continue; }
    snapped.push({ col, row, bead: classToBead(b.cls), err: dx + dy });
  }

  const total = beads.length;
  if (misfits / total > 0.25 || snapped.length < MIN_BLOBS) {
    return {
      ok: false,
      reason: "Photo quality too poor to read",
      detail: "The markers are there but too skewed or blurred to line up into a grid. Retake the photo square-on to the screen, filling the frame, with no glare.",
    };
  }

  // A bead plate fills each column from the top straight down and never goes
  // deeper than 6, so no column can hold an unbroken run of more than 6
  // markers. A grid that does is some other board, and reading 6 rows out of
  // it would invent a shoe. Two such columns rules out a stray sitting
  // directly under the plate.
  const deepColumns = [...new Set(snapped.map(s => s.col))].filter(col => {
    const rows = snapped.filter(s => s.col === col).map(s => s.row).sort((a, b) => a - b);
    let longest = 1, current = 1;
    for (let i = 1; i < rows.length; i++) {
      current = rows[i] === rows[i - 1] + 1 ? current + 1 : 1;
      if (current > longest) longest = current;
    }
    return longest > ROWS_MAX;
  });
  if (deepColumns.length >= 2) {
    return {
      ok: false,
      reason: "This doesn't look like a bead plate",
      detail: `Columns of more than ${ROWS_MAX} markers were found — a bead plate fills each column top to bottom and is never deeper than ${ROWS_MAX}. Make sure only the bead plate screen is in frame, not the whole board.`,
    };
  }

  // Anything else the camera caught — the caption strip under the screen, a
  // reflection, the roads above — lands on other lattice rows, so keep the
  // 6-row band holding the most markers and discard the rest instead of
  // calling the whole photo unusable.
  let bandTop = snapped[0].row;
  let bandCount = -1;
  for (const { row: top } of snapped) {
    const n = snapped.filter(s => s.row >= top && s.row < top + ROWS_MAX).length;
    if (n > bandCount) { bandCount = n; bandTop = top; }
  }
  let plate = snapped.filter(s => s.row >= bandTop && s.row < bandTop + ROWS_MAX);

  // Likewise across: keep the unbroken run of columns holding the most
  // markers, so something off to one side can't stretch the plate to reach it.
  const run = bestColumnRun(plate.map(s => s.col));
  plate = plate.filter(s => s.col >= run.from && s.col <= run.to);

  if (plate.length < MIN_BLOBS) {
    return {
      ok: false,
      reason: "No bead plate found in this photo",
      detail: "The markers in this photo don't form a 6-row plate. Frame the bead plate screen square-on, with the whole grid visible.",
    };
  }

  // The plate fills from the top of its first column, so the topmost and
  // leftmost markers found are row 0 and column 0.
  const rowBase = Math.min(...plate.map(s => s.row));
  const colBase = Math.min(...plate.map(s => s.col));

  const cells = new Map<string, { bead: Bead; err: number }>();
  let conflicts = 0;
  let maxRow = 0;
  let maxCol = 0;
  for (const s of plate) {
    const col = s.col - colBase;
    const row = s.row - rowBase;
    const key = `${col},${row}`;
    const existing = cells.get(key);
    if (existing) {
      conflicts++;
      if (s.err >= existing.err) continue;
    }
    cells.set(key, { bead: s.bead, err: s.err });
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }

  if (conflicts / plate.length > 0.1) {
    return {
      ok: false,
      reason: "Photo quality too poor to read",
      detail: "Markers are overlapping on the grid, so the plate can't be read reliably. Retake the photo square-on to the screen.",
    };
  }

  const rows = maxRow + 1;
  const cols = maxCol + 1;

  // Read column-major, exactly how a plate fills. Trailing empties are simply
  // hands not yet played; a gap *before* the last disc is a missed read.
  const results: BeadCell[] = [];
  const unresolved: number[] = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const c = cells.get(`${col},${row}`);
      results.push(c ? c.bead : "?");
    }
  }
  while (results.length && results[results.length - 1] === "?") results.pop();
  results.forEach((r, i) => { if (r === "?") unresolved.push(i); });

  if (!results.length) {
    return {
      ok: false,
      reason: "No results found in this photo",
      detail: "A grid was located but no results could be read from it.",
    };
  }

  // Too many holes means the read is unreliable as a whole, not just patchy.
  if (unresolved.length / results.length > 0.12) {
    return {
      ok: false,
      reason: "Photo quality too poor to read",
      detail: `${unresolved.length} of ${results.length} results couldn't be made out. Retake the photo with better lighting and the whole plate in frame.`,
    };
  }

  const confidence = Math.max(
    0,
    Math.min(1, 1 - (misfits + conflicts + unresolved.length * 1.5) / total),
  );

  const warnings: string[] = [];
  if (unresolved.length) {
    warnings.push(`${unresolved.length} cell${unresolved.length > 1 ? "s" : ""} couldn't be read — marked "?" for you to set.`);
  }
  if (rows < ROWS_MAX) {
    warnings.push(`Only ${rows} rows detected — check the top and bottom of the plate are in frame.`);
  }
  if (confidence < 0.85) {
    warnings.push("Low confidence read — check every result against the photo before saving.");
  }

  return { ok: true, results, rows, cols, confidence, unresolved, warnings };
}
