// Screen-photo store: the actual casino / play-screen photos a user attaches
// to a baccarat screen (a shoe), persisted to localStorage until the Supabase
// backend pass. Each screen holds at most two photos.
//
// Photos are downscaled to a JPEG data URL before storage so a couple of phone
// snaps don't blow the localStorage quota — real image blobs move to Supabase
// Storage later; this keeps the prototype self-contained.

export const MAX_PHOTOS = 2;

const key = (screenId: string) => `bp-photos-${screenId}`;

export function loadPhotos(screenId: string): string[] {
  try {
    const raw = localStorage.getItem(key(screenId));
    if (raw) return (JSON.parse(raw) as string[]).slice(0, MAX_PHOTOS);
  } catch { /* fall through */ }
  return [];
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export function savePhotos(screenId: string, photos: string[]): SaveResult {
  const trimmed = photos.slice(0, MAX_PHOTOS);
  try {
    if (trimmed.length === 0) localStorage.removeItem(key(screenId));
    else localStorage.setItem(key(screenId), JSON.stringify(trimmed));
    return { ok: true };
  } catch {
    return { ok: false, error: "Storage is full — remove a photo or attach a smaller image." };
  }
}

/**
 * Read an image File, downscale it so its longest edge is at most `maxDim`,
 * and return a JPEG data URL. Keeps stored photos small enough for
 * localStorage while staying legible for reviewing a shoe.
 */
export function fileToDataUrl(file: File, maxDim = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("That file isn't an image."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const longest = Math.max(width, height);
      if (longest > maxDim) {
        const scale = maxDim / longest;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Couldn't process that image."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image."));
    };
    img.src = url;
  });
}
