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
  /** Draw hollow rings of this stroke width instead of solid discs */
  ringStroke?: number;
  /** Light panel with grid lines, like a Crown-style screen */
  lightBackground?: boolean;
}

function drawPlate(seq: Bead[], opts: DrawOpts = {}): ImageLike {
  const {
    pitch = 24, radius = 9, margin = 12, rows = 6, jitter = 0, holes = [], noise = 0,
    ringStroke, lightBackground = false,
  } = opts;
  const cols = Math.ceil(seq.length / rows);
  const width = margin * 2 + cols * pitch;
  const height = margin * 2 + rows * pitch;
  const data = new Uint8ClampedArray(width * height * 4);

  const bg = lightBackground ? [244, 246, 249] : [18, 20, 24];
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    data[p] = bg[0]; data[p + 1] = bg[1]; data[p + 2] = bg[2]; data[p + 3] = 255;
  }

  // Pale blue-grey cell borders, as a real screen draws them
  if (lightBackground) {
    const line = [176, 190, 210];
    const put = (x: number, y: number) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const p = (y * width + x) * 4;
      data[p] = line[0]; data[p + 1] = line[1]; data[p + 2] = line[2];
    };
    for (let c = 0; c <= cols; c++) for (let y = margin; y < margin + rows * pitch; y++) put(margin + c * pitch, y);
    for (let r = 0; r <= rows; r++) for (let x = margin; x < margin + cols * pitch; x++) put(x, margin + r * pitch);
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
    const inner = ringStroke ? radius - ringStroke : 0;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const d2 = (x - cx) ** 2 + (y - cy) ** 2;
        if (d2 > radius ** 2) continue;
        if (inner > 0 && d2 < inner ** 2) continue; // hollow centre
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

/** 3x3 box blur — stands in for a phone camera's soft focus. */
function blur(img: ImageLike): ImageLike {
  const { width: W, height: H } = img;
  const src = img.data;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            sum += src[(ny * W + nx) * 4 + c]; n++;
          }
        }
        out[(y * W + x) * 4 + c] = sum / n;
      }
      out[(y * W + x) * 4 + 3] = 255;
    }
  }
  return { data: out, width: W, height: H };
}

/** Horizontal banding, as a camera picks up off an LCD. */
function withMoire(img: ImageLike): ImageLike {
  const { width: W, height: H } = img;
  const out = new Uint8ClampedArray(img.data);
  for (let y = 0; y < H; y++) {
    const band = Math.sin(y / 2.3) * 9;
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      out[p] += band; out[p + 1] += band; out[p + 2] += band;
    }
  }
  return { data: out, width: W, height: H };
}

/** A filled coloured blob — stands in for glare, a caption glyph, a stray. */
function withSpot(img: ImageLike, cx: number, cy: number, r: number,
                  [cr, cg, cb]: [number, number, number]): ImageLike {
  const { width: W, height: H } = img;
  const out = new Uint8ClampedArray(img.data);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const p = (y * W + x) * 4;
      out[p] = cr; out[p + 1] = cg; out[p + 2] = cb;
    }
  }
  return { data: out, width: W, height: H };
}

/** The small black pair marker that sits on a ring and bites into it. */
function withPairDot(img: ImageLike, cx: number, cy: number, r = 7): ImageLike {
  const { width: W, height: H } = img;
  const out = new Uint8ClampedArray(img.data);
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const p = (y * W + x) * 4;
      out[p] = 15; out[p + 1] = 15; out[p + 2] = 18;
    }
  }
  return { data: out, width: W, height: H };
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

  // Casinos draw the plate either way, so both have to read. This mirrors a
  // real Crown Melbourne screen: thick hollow rings on a white panel with pale
  // grid lines, last column part-filled.
  const CROWN: Bead[] = [
    "B", "B", "B", "B", "B", "P",
    "B", "T", "B", "P", "B", "T",
    "B", "P", "B", "B", "P", "B",
    "B", "P",
  ];

  it("reads hollow rings on a light panel (Crown-style screen)", () => {
    const res = extractBeadPlate(drawPlate(CROWN, {
      pitch: 60, radius: 25, ringStroke: 6, margin: 30, lightBackground: true,
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.results).toEqual(CROWN);
    expect(res.rows).toBe(6);
    expect(res.unresolved).toEqual([]);
  });

  it("reads hollow rings drawn with a thin stroke", () => {
    // A 3px stroke on a 25px radius covers only ~22% of the bounding box —
    // well under what a solid disc covers.
    const res = extractBeadPlate(drawPlate(CROWN, {
      pitch: 60, radius: 25, ringStroke: 3, margin: 30, lightBackground: true,
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.results).toEqual(CROWN);
  });

  it("reads a photographed ring plate with skew and noise", () => {
    const res = extractBeadPlate(drawPlate(CROWN, {
      pitch: 60, radius: 25, ringStroke: 7, margin: 30,
      lightBackground: true, jitter: 3, noise: 12,
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.results).toEqual(CROWN);
  });

  it("reads a real-world phone shot of a ring plate", () => {
    // Everything a photo of a casino screen actually adds: soft focus, the
    // moiré banding a camera picks up off an LCD, and a pair marker — a small
    // black dot that sits on the ring and nicks a bite out of it.
    let img = drawPlate(CROWN, {
      pitch: 60, radius: 25, ringStroke: 7, margin: 30,
      lightBackground: true, jitter: 2,
    });
    img = withPairDot(img, 30 + 3 * 60 + 30 - 18, 30 + 30 - 18); // col 4, row 1
    img = withMoire(img);
    img = blur(img);

    const res = extractBeadPlate(img);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.results).toEqual(CROWN);
  });

  it("finds the plate when the photo also caught other things", () => {
    // The real failure case: a photo of a table screen catches more than the
    // plate — a caption strip below it and glare blobs off to the side. Those
    // land on their own lattice rows and used to be counted as extra rows of
    // the plate ("11 rows of markers were found"), killing the read.
    let img = drawPlate(CROWN, {
      pitch: 60, radius: 25, ringStroke: 7, margin: 30, lightBackground: true,
    });
    // Caption strip well below the plate
    for (let i = 0; i < 7; i++) img = withSpot(img, 60 + i * 70, 30 + 6 * 60 + 55, 16, COLOURS.B);
    // A couple of stray highlights out to the right of the plate
    img = withSpot(img, 30 + 5 * 60, 30 + 90, 20, COLOURS.T);
    img = withSpot(img, 30 + 6 * 60, 30 + 150, 20, COLOURS.P);

    const res = extractBeadPlate(img);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.results).toEqual(CROWN);
    expect(res.rows).toBe(6);
  });

  it("reads a plate that sits low in the frame", () => {
    // The lattice origin must come from the markers, not the image corner.
    const res = extractBeadPlate(drawPlate(CROWN, {
      pitch: 60, radius: 25, ringStroke: 7, margin: 200, lightBackground: true,
    }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.results).toEqual(CROWN);
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
    expect(res.detail).toMatch(/deeper|column/i);
  });

  it("rejects an image too small to hold a plate", () => {
    const res = extractBeadPlate({ data: new Uint8ClampedArray(20 * 20 * 4), width: 20, height: 20 });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/too small/i);
  });
});
