import { signal } from "@preact/signals";
import { readExif, type PhotoExif } from "./exif";
import type { Recipe } from "./np3/recipe";
import { isPhotoFile, isRawFile, toViewablePhoto } from "./raw";

/*
 * Photos taken with each recipe — the personal filter library. Stored in
 * IndexedDB (photos are too big for localStorage), downscaled on import so the
 * library stays small. Everything stays on this computer.
 */

export interface PhotoThumb {
  id: string;
  recipeId: string;
  thumbUrl: string;
  name: string;
  /** Identifies the original file (name, size, date) so adding it again is skipped. */
  sourceKey?: string;
  createdAt: number;
  /** Shooting details for frames; absent for photos added before 0.6.3 or without EXIF. */
  exif?: PhotoExif;
}

interface PhotoRecord {
  id: string;
  recipeId: string;
  name: string;
  sourceKey?: string;
  createdAt: number;
  exif?: PhotoExif;
  full: Blob;
  thumb: Blob;
}

const DB_NAME = "np3lab";
const STORE = "photos";
const FULL_EDGE = 2048;
const THUMB_EDGE = 960;

/** recipeId → photos (newest first). */
export const photosByRecipe = signal<Record<string, PhotoThumb[]>>({});

let dbPromise: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("recipeId", "recipeId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const req = run(d.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

const toThumb = (r: PhotoRecord): PhotoThumb => ({
  id: r.id,
  recipeId: r.recipeId,
  name: r.name,
  sourceKey: r.sourceKey,
  createdAt: r.createdAt,
  exif: r.exif,
  thumbUrl: URL.createObjectURL(r.thumb),
});

function setIndex(list: PhotoThumb[]) {
  const map: Record<string, PhotoThumb[]> = {};
  for (const p of list) (map[p.recipeId] ??= []).push(p);
  for (const k of Object.keys(map)) map[k].sort((a, b) => b.createdAt - a.createdAt);
  photosByRecipe.value = map;
}

export async function loadPhotoIndex() {
  try {
    const all = await tx<PhotoRecord[]>("readonly", (s) => s.getAll());
    setIndex(all.map(toThumb));
  } catch (err) {
    console.warn("[NP3 Lab] photo library unavailable", err);
  }
}

async function downscale(file: Blob, edge: number, quality: number): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", quality));
}

export async function addPhotos(recipeId: string, files: File[]): Promise<number> {
  let added = 0;
  const current = Object.values(photosByRecipe.value).flat();
  const sourceKey = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
  const inRecipe = current.filter((p) => p.recipeId === recipeId);
  const already = new Set(inRecipe.flatMap((p) => (p.sourceKey ? [p.sourceKey] : [])));
  // Photos added before keys existed can only be recognised by name.
  const legacyNames = new Set(inRecipe.filter((p) => !p.sourceKey).map((p) => p.name));
  const readOriginalExif = async (f: File) => readExif(new Uint8Array(await f.slice(0, 1024 * 1024).arrayBuffer())) ?? undefined;
  for (const original of files.filter(isPhotoFile)) {
    // The same file added twice (or dropped again later) stays one photo; one added before
    // shooting details were kept gets them now.
    const same = inRecipe.find((p) => p.sourceKey === sourceKey(original) || (!p.sourceKey && p.name === original.name));
    if (same || already.has(sourceKey(original)) || legacyNames.has(original.name)) {
      if (same && !same.exif) {
        const r = await tx<PhotoRecord | undefined>("readonly", (st) => st.get(same.id));
        const exif = r && (await readOriginalExif(original));
        if (r && exif) {
          await tx("readwrite", (st) => st.put({ ...r, exif }));
          same.exif = exif;
        }
      }
      continue;
    }
    try {
      // RAW files are stored as the JPEG the camera embedded (with the recipe applied).
      const file = await toViewablePhoto(original);
      if (!file) continue;
      const record: PhotoRecord = {
        id: `ph-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        recipeId,
        name: original.name,
        sourceKey: sourceKey(original),
        createdAt: Date.now() + added,
        // Read from the original: re-encoding below drops the EXIF.
        exif: await readOriginalExif(original),
        full: await downscale(file, FULL_EDGE, 0.88),
        thumb: await downscale(file, THUMB_EDGE, 0.82),
      };
      await tx("readwrite", (s) => s.put(record));
      current.push(toThumb(record));
      already.add(record.sourceKey!);
      added++;
    } catch (err) {
      console.warn("[NP3 Lab] could not add photo", original.name, err);
    }
  }
  setIndex(current);
  return added;
}

export async function deletePhoto(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  const all = Object.values(photosByRecipe.value).flat();
  const gone = all.find((p) => p.id === id);
  if (gone) URL.revokeObjectURL(gone.thumbUrl);
  setIndex(all.filter((p) => p.id !== id));
}

export async function fullPhoto(id: string): Promise<Blob | null> {
  return (await tx<PhotoRecord | undefined>("readonly", (s) => s.get(id)))?.full ?? null;
}

/** Object URL of the full-size photo (caller revokes it). */
export async function fullPhotoUrl(id: string): Promise<string | null> {
  const full = await fullPhoto(id);
  return full ? URL.createObjectURL(full) : null;
}

/**
 * Nikon writes the Picture Control name into the photo's EXIF maker note.
 * Find the recipe whose camera name appears there (longest match wins).
 */
export async function matchRecipeByExif(file: File, recipes: Recipe[]): Promise<Recipe | null> {
  const raw = isRawFile(file);
  if (!raw && !/jpe?g$/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null;
  // In a NEF the maker note sits a little further in than in a JPEG's EXIF block.
  const head = new Uint8Array(await file.slice(0, (raw ? 512 : 256) * 1024).arrayBuffer());
  let text = "";
  for (let i = 0; i < head.length; i++) text += String.fromCharCode(head[i]);
  if ((!raw && !text.includes("Exif")) || !text.includes("Nikon")) return null;
  let best: Recipe | null = null;
  for (const r of recipes) {
    const name = r.npName.trim();
    if (name.length < 3) continue;
    // Stored as a fixed 20-byte field, so a long name can be cut short.
    if (text.includes(name.slice(0, 19)) && (!best || name.length > best.npName.length)) best = r;
  }
  return best;
}

