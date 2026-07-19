// Screen-photo store: the actual casino / play-screen photos a user attaches
// to a baccarat screen (a shoe). Each screen holds at most two photos.
//
// Cloud mode (signed in): photos live in the private Supabase Storage bucket
// "screen-photos" under <user_id>/<screen_id>/<name>.jpg — no localStorage
// quota worries, and they follow the account across devices.
// Local mode: downscaled JPEG data URLs in localStorage, as before.

import { supabase } from "./supabase";
import { getCloudUserId } from "./cloud";

export const MAX_PHOTOS = 2;
const BUCKET = "screen-photos";

const key = (screenId: string) => `bp-photos-${screenId}`;

export interface ScreenPhoto {
  /** Displayable URL (object URL in cloud mode, data URL in local mode). */
  url: string;
  /** Storage identity used for delete (file name in cloud, index locally). */
  name: string;
}

function cloudPrefix(screenId: string): string | null {
  const uid = getCloudUserId();
  return supabase && uid ? `${uid}/${screenId}` : null;
}

// ── Local-mode helpers (localStorage data URLs) ─────────────────────────────

function loadLocal(screenId: string): string[] {
  try {
    const raw = localStorage.getItem(key(screenId));
    if (raw) return (JSON.parse(raw) as string[]).slice(0, MAX_PHOTOS);
  } catch { /* fall through */ }
  return [];
}

function saveLocal(screenId: string, photos: string[]): boolean {
  try {
    if (photos.length === 0) localStorage.removeItem(key(screenId));
    else localStorage.setItem(key(screenId), JSON.stringify(photos.slice(0, MAX_PHOTOS)));
    return true;
  } catch {
    return false;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function listPhotos(screenId: string): Promise<ScreenPhoto[]> {
  const prefix = cloudPrefix(screenId);
  if (!prefix) {
    return loadLocal(screenId).map((url, i) => ({ url, name: String(i) }));
  }
  const { data, error } = await supabase!.storage.from(BUCKET).list(prefix);
  if (error || !data) return [];
  const files = data
    .filter(f => f.name && !f.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, MAX_PHOTOS);
  const photos: ScreenPhoto[] = [];
  for (const f of files) {
    const { data: blob } = await supabase!.storage.from(BUCKET).download(`${prefix}/${f.name}`);
    if (blob) photos.push({ url: URL.createObjectURL(blob), name: f.name });
  }
  return photos;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function addPhoto(screenId: string, file: File): Promise<SaveResult> {
  const dataUrl = await fileToDataUrl(file); // downscale in both modes
  const prefix = cloudPrefix(screenId);
  if (!prefix) {
    const next = [...loadLocal(screenId), dataUrl].slice(0, MAX_PHOTOS);
    return saveLocal(screenId, next)
      ? { ok: true }
      : { ok: false, error: "Storage is full — remove a photo or attach a smaller image." };
  }
  const blob = await (await fetch(dataUrl)).blob();
  const { error } = await supabase!.storage
    .from(BUCKET)
    .upload(`${prefix}/${Date.now()}.jpg`, blob, { contentType: "image/jpeg" });
  return error ? { ok: false, error: `Upload failed: ${error.message}` } : { ok: true };
}

export async function removePhoto(screenId: string, photo: ScreenPhoto): Promise<void> {
  const prefix = cloudPrefix(screenId);
  if (!prefix) {
    const next = loadLocal(screenId).filter((_, i) => i !== Number(photo.name));
    saveLocal(screenId, next);
    return;
  }
  await supabase!.storage.from(BUCKET).remove([`${prefix}/${photo.name}`]);
}

/**
 * Move a screen's photos to another screen id — used when a live session is
 * saved, so its photos follow it into the Library. Fire-and-forget in cloud
 * mode; instant in local mode.
 */
export function movePhotos(fromScreenId: string, toScreenId: string): void {
  const from = cloudPrefix(fromScreenId);
  const to = cloudPrefix(toScreenId);
  if (!from || !to) {
    const photos = loadLocal(fromScreenId);
    if (photos.length === 0) return;
    saveLocal(toScreenId, photos);
    saveLocal(fromScreenId, []);
    return;
  }
  supabase!.storage.from(BUCKET).list(from).then(async ({ data }) => {
    for (const f of data ?? []) {
      if (!f.name || f.name.startsWith(".")) continue;
      await supabase!.storage.from(BUCKET).move(`${from}/${f.name}`, `${to}/${f.name}`);
    }
  }).catch(err => console.warn("[photos] move failed:", err));
}

/**
 * Read an image File, downscale it so its longest edge is at most `maxDim`,
 * and return a JPEG data URL — small enough for localStorage in local mode,
 * and a sane upload size in cloud mode.
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
