import { describe, expect, it } from "vitest";
import { extractBeadPlate, type Bead, type ImageLike } from "./beadExtract";

// ── Synthetic bead plates ───────────────────────────────────────────────────
// Draws the same thing a casino screen does: a dark panel with a regular grid
// of saturated discs, filled column-major.

const COLOURS: Record<Bead, [number, number, number]> = {
  B: [200, 30, 40],   // banker red
  P: [30, 90, 200],   // player blue
  T: [30, 160, 70],   // tie green
};

interface DrawOpts {
  pitch?: number;
  radius?: number;
  margin?: number;
  rows?: number;
  /** Extra pixel jitter applied to each disc centre (simulates a skewed shot) */
  jitter?: number;
  /** Cells to leave blank even though later cells are filled */
  holes?: number[];
  /** Uniform noise amplitude added to every channel */
  noise?: number;
}

function drawPlate(seq: Bead[], opts: DrawOpts = {}): ImageLike {
  const { pitch = 24, radius = 9, margin = 12, rows = 6, jitter = 0, holes = [], noise = 0 } = opts;
  const cols = Math.ceil(seq.length / rows);
  const width = margin * 2 + cols * pitch;
  const height = margin * 2 + rows * pitch;
  const data = new Uint8ClampedArray(width * height * 4);

  // Dark panel background
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    data[p] = 18; data[p + 1] = 20; data[p + 2] = 24; data[p + 3] = 255;
  }

  const rand = mulberry32(7);
  seq.forEach((bead, idx) => {
    if (holes.includes(idx)) return;
    const col = Math.floor(idx / rows);
    const row = idx % rows;
    const jx = jitter ? (rand() * 2 - 1) * jitter : 0;
    const jy = jitter ? (rand() * 2 - 1) * jitter : 0;
    const cx = margin + col * pitch + pitch / 2 + jx;
    const cy = margin + row * pitch + pitch / 2 + jy;
    const [r, g, b] = COLOURS[bead];
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) continue;
        const p = (y * width + x) * 4;
        data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
      }
    }
  });

  if (noise) {
    for (let i = 0; i < width * height; i++) {
      const p = i * 4;
      const n = (rand() * 2 - 1) * noise;
      data[p] += n; data[p + 1] += n; data[p + 2] += n;
    }
  }

  return { data, width, height };
}

/** Deterministic PRNG so a failing test always fails the same way. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHOE: Bead[] = [
  "B", "B", "P", "B", "B", "P",
  "P", "B", "T", "B", "P", "P",
  "P", "B", "B", "B", "P", "P",
  "B", "P", "B", "B", "P", "P",
  "P", "B", "B", "B", "P", "P",
];

describe("extractBeadPlate", () => {
  it("reads a clean synthetic bead plate exactly", () => {
    const res = extractBeadPlate(drawPlate(SHOE));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.results).toEqual(SHOE);
    expect(res.rows).toBe(6);
    expect(res.cols).toBe(5);
    expect(res.unresolved).toEqual([]);
    expect(res.confidence).toBeGreaterThan(0.95);
  });

  it("reads a partial last column and stops at the last result", () => {
    const partial = SHOE.slice(0, 26);
    const res = extractBeadPlate(drawPlate(partial));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.results).toEqual(partial);
  });

  it("tolerates a slightly skewed, noisy photo", () => {
    const res = extractBeadPlate(drawPlate(SHOE, { jitter: 2, noise: 14 }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.results).toEqual(SHOE);
  });

  it("scales with the photo — a large, tightly packed plate still reads", () => {
    const res = extractBeadPlate(drawPlate(SHOE, { pitch: 60, radius: 25, margin: 40 }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.results).toEqual(SHOE);
  });

  it("marks an unreadable interior cell rather than guessing it", () => {
    const res = extractBeadPlate(drawPlate(SHOE, { holes: [14] }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.results[14]).toBe("?");
    expect(res.unresolved).toEqual([14]);
    // Every other result is still correct
    res.results.forEach((r, i) => { if (i !== 14) expect(r).toBe(SHOE[i]); });
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it("rejects a photo with no bead plate in it", () => {
    const blank: ImageLike = {
      data: new Uint8ClampedArray(200 * 200 * 4).fill(20),
      width: 200, height: 200,
    };
    const res = extractBeadPlate(blank);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/no bead plate/i);
  });

  it("rejects a photo of something else that happens to be colourful", () => {
    // A handful of scattered discs — colourful, but not a grid
    const width = 300, height = 300;
    const data = new Uint8ClampedArray(width * height * 4).fill(20);
    for (let i = 0; i < width * height; i++) data[i * 4 + 3] = 255;
    const spots = [[30, 40], [200, 60], [90, 210], [260, 250], [150, 130]];
    spots.forEach(([cx, cy], k) => {
      const [r, g, b] = k % 2 ? COLOURS.B : COLOURS.P;
      for (let y = cy - 10; y <= cy + 10; y++) {
        for (let x = cx - 10; x <= cx + 10; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 > 100) continue;
          const p = (y * width + x) * 4;
          data[p] = r; data[p + 1] = g; data[p + 2] = b;
        }
      }
    });
    const res = extractBeadPlate({ data, width, height });
    expect(res.ok).toBe(false);
  });

  it("rejects a grid deeper than a bead plate can be", () => {
    // 8 rows — that's a board photo, not a bead plate
    const long = [...SHOE, ...SHOE].slice(0, 48);
    const res = extractBeadPlate(drawPlate(long, { rows: 8 }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.detail).toMatch(/rows/i);
  });

  it("rejects an image too small to hold a plate", () => {
    const res = extractBeadPlate({ data: new Uint8ClampedArray(20 * 20 * 4), width: 20, height: 20 });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/too small/i);
  });
});
