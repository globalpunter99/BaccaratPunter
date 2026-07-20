// Browser glue for the bead-plate detector: File → canvas pixels →
// `extractBeadPlate`. The detection itself is pure and lives in
// game/beadExtract.ts.

import { extractBeadPlate, type ExtractResult } from "../game/beadExtract";

// Phone photos are far larger than the detector needs. Working at ~1200px on
// the long edge keeps discs comfortably above the minimum blob size while
// bounding the connected-component pass to a few megapixels.
const MAX_EDGE = 1200;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = url;
  });
}

export async function extractFromFile(file: File): Promise<ExtractResult> {
  const url = URL.createObjectURL(file);
  try {
    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } catch {
      return {
        ok: false,
        reason: "Image could not be opened",
        detail: "This browser couldn't decode the file. HEIC photos sometimes need converting to JPG first.",
      };
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return {
        ok: false,
        reason: "Image could not be read",
        detail: "The browser wouldn't provide a drawing surface for the photo.",
      };
    }
    ctx.drawImage(img, 0, 0, w, h);
    return extractBeadPlate(ctx.getImageData(0, 0, w, h));
  } finally {
    URL.revokeObjectURL(url);
  }
}
