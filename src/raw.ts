/*
 * Nikon RAW (NEF/NRW) support for "Shot with this recipe". Browsers can't decode RAW,
 * but every NEF carries a full-size JPEG the camera rendered with the Picture Control
 * (i.e. the recipe) applied. We pull out the largest one and turn it upright using the
 * NEF's orientation tag (the embedded JPEG has none of its own).
 */

export const RAW_EXT = /\.(nef|nrw)$/i;
/** For <input accept>: photos plus Nikon RAW. */
export const PHOTO_ACCEPT = "image/*,.nef,.NEF,.nrw,.NRW";

export const isRawFile = (f: File) => RAW_EXT.test(f.name);
export const isPhotoFile = (f: File) => f.type.startsWith("image/") || isRawFile(f);

/** The TIFF structure we need (IFDs, preview offsets) sits in the first few hundred KB. */
const HEADER_BYTES = 1024 * 1024;
const MAX_IFDS = 32;
const MAX_ENTRIES = 1000;
const MAX_PREVIEW_BYTES = 40 * 1024 * 1024;

export interface NefPreview {
  offset: number;
  length: number;
  /** EXIF orientation of the shot (1 = upright, 6 = rotate 90° CW, 8 = rotate 90° CCW, 3 = 180°). */
  orientation: number;
}

/** Find the largest embedded JPEG and the orientation in a NEF's TIFF header. Bounds-checked: the file is untrusted. */
export function findNefPreview(head: Uint8Array, fileSize: number): NefPreview | null {
  if (head.length < 16) return null;
  const le = head[0] === 0x49 && head[1] === 0x49;
  const be = head[0] === 0x4d && head[1] === 0x4d;
  if (!le && !be) return null;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);
  if (u16(2) !== 42) return null;

  let orientation = 1;
  let best: { offset: number; length: number } | null = null;
  const queue = [u32(4)];
  const seen = new Set<number>();
  let first = true;
  while (queue.length > 0 && seen.size < MAX_IFDS) {
    const off = queue.shift()!;
    if (off < 8 || off + 2 > head.length || seen.has(off)) {
      first = false;
      continue;
    }
    seen.add(off);
    const count = u16(off);
    if (count > MAX_ENTRIES || off + 2 + count * 12 + 4 > head.length) continue;
    let jpegOffset = 0;
    let jpegLength = 0;
    for (let i = 0; i < count; i++) {
      const e = off + 2 + i * 12;
      const tag = u16(e);
      const type = u16(e + 2);
      const n = u32(e + 4);
      if (tag === 0x0112 && first && type === 3) orientation = u16(e + 8);
      else if (tag === 0x014a) {
        // SubIFDs: one offset inline, or a list of offsets.
        if (n === 1) queue.push(u32(e + 8));
        else if (n > 1 && n <= 8) {
          const list = u32(e + 8);
          for (let k = 0; k < n && list + k * 4 + 4 <= head.length; k++) queue.push(u32(list + k * 4));
        }
      } else if (tag === 0x0201) jpegOffset = u32(e + 8);
      else if (tag === 0x0202) jpegLength = u32(e + 8);
    }
    const next = u32(off + 2 + count * 12);
    if (next) queue.push(next);
    first = false;
    if (jpegOffset > 0 && jpegLength > 0 && jpegLength <= MAX_PREVIEW_BYTES && jpegOffset + jpegLength <= fileSize) {
      if (!best || jpegLength > best.length) best = { offset: jpegOffset, length: jpegLength };
    }
  }
  return best && { ...best, orientation: [1, 3, 6, 8].includes(orientation) ? orientation : 1 };
}

/** Draw `bmp` upright for an EXIF orientation, scaled so the long edge is at most `edge`. */
function drawUpright(bmp: ImageBitmap, orientation: number, edge: number): HTMLCanvasElement {
  const turned = orientation === 6 || orientation === 8;
  const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = turned ? h : w;
  canvas.height = turned ? w : h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  if (orientation === 3) ctx.setTransform(-1, 0, 0, -1, w, h);
  else if (orientation === 6) ctx.setTransform(0, 1, -1, 0, h, 0);
  else if (orientation === 8) ctx.setTransform(0, -1, 1, 0, 0, w);
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas;
}

/** An upright JPEG File from a NEF's embedded preview (long edge ≤ `edge`), or null if it has none. */
export async function rawToJpeg(file: File, edge = 4096): Promise<File | null> {
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  const preview = findNefPreview(head, file.size);
  if (!preview) return null;
  const jpeg = file.slice(preview.offset, preview.offset + preview.length, "image/jpeg");
  const bmp = await createImageBitmap(jpeg, { imageOrientation: "none" });
  try {
    const canvas = drawUpright(bmp, preview.orientation, edge);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.92),
    );
    return new File([blob], file.name.replace(RAW_EXT, ".jpg"), { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    bmp.close();
  }
}

/** Photos pass through; RAW files become their embedded JPEG; anything else is null. */
export async function toViewablePhoto(file: File): Promise<File | null> {
  if (file.type.startsWith("image/") && !isRawFile(file)) return file;
  if (!isRawFile(file)) return null;
  try {
    return await rawToJpeg(file);
  } catch (err) {
    console.warn("[NP3 Lab] could not read RAW preview", file.name, err);
    return null;
  }
}
