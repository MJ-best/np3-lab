/*
 * The shooting details a frame shows: camera, lens, focal length, aperture, shutter, ISO, date.
 * Read from a JPEG's EXIF block or a NEF's own TIFF header. Bounds-checked: the file is untrusted.
 */

export interface PhotoExif {
  make?: string;
  model?: string;
  lens?: string;
  /** mm */
  focal?: number;
  fNumber?: number;
  /** seconds */
  exposure?: number;
  iso?: number;
  /** "YYYY:MM:DD HH:MM:SS" as the camera wrote it. */
  date?: string;
}

const MAX_ENTRIES = 1000;

/** Where the TIFF structure starts: 0 for a NEF, inside APP1 for a JPEG; -1 if there is none. */
function tiffStart(b: Uint8Array): number {
  if (b[0] === 0x49 || b[0] === 0x4d) return 0;
  if (b[0] !== 0xff || b[1] !== 0xd8) return -1;
  let o = 2;
  while (o + 4 <= b.length && b[o] === 0xff) {
    const marker = b[o + 1];
    const len = (b[o + 2] << 8) | b[o + 3];
    // APP1 "Exif\0\0"
    if (marker === 0xe1 && b[o + 4] === 0x45 && b[o + 5] === 0x78 && b[o + 6] === 0x69 && b[o + 7] === 0x66) return o + 10;
    if (marker === 0xda || len < 2) return -1;
    o += 2 + len;
  }
  return -1;
}

export function readExif(bytes: Uint8Array): PhotoExif | null {
  const base = tiffStart(bytes);
  if (base < 0 || base + 8 > bytes.length) return null;
  const le = bytes[base] === 0x49;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ok = (o: number, n: number) => o >= 0 && o + n <= bytes.length;
  const u16 = (o: number) => (ok(o, 2) ? view.getUint16(o, le) : 0);
  const u32 = (o: number) => (ok(o, 4) ? view.getUint32(o, le) : 0);
  if (u16(base + 2) !== 42) return null;

  type Entry = { type: number; count: number; at: number };
  const ifd = (offset: number): Map<number, Entry> => {
    const out = new Map<number, Entry>();
    const start = base + offset;
    const n = Math.min(u16(start), MAX_ENTRIES);
    for (let i = 0; i < n; i++) {
      const e = start + 2 + i * 12;
      if (!ok(e, 12)) break;
      const type = u16(e + 2);
      const count = u32(e + 4);
      const size = ([0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8][type] ?? 1) * count;
      out.set(u16(e), { type, count, at: size <= 4 ? e + 8 : base + u32(e + 8) });
    }
    return out;
  };
  const text = (e?: Entry) => {
    if (!e || e.type !== 2 || !ok(e.at, e.count)) return undefined;
    let s = "";
    for (let i = 0; i < e.count && bytes[e.at + i]; i++) s += String.fromCharCode(bytes[e.at + i]);
    return s.trim() || undefined;
  };
  const num = (e?: Entry) => {
    if (!e) return undefined;
    if (e.type === 3) return u16(e.at);
    if (e.type === 4) return u32(e.at);
    if ((e.type === 5 || e.type === 10) && ok(e.at, 8)) {
      const d = u32(e.at + 4);
      return d ? u32(e.at) / d : undefined;
    }
    return undefined;
  };

  const ifd0 = ifd(u32(base + 4));
  const exifPtr = num(ifd0.get(0x8769));
  const sub = exifPtr ? ifd(exifPtr) : new Map<number, Entry>();
  const exif: PhotoExif = {
    make: text(ifd0.get(0x010f)),
    model: text(ifd0.get(0x0110)),
    lens: text(sub.get(0xa434)),
    focal: num(sub.get(0x920a)),
    fNumber: num(sub.get(0x829d)),
    exposure: num(sub.get(0x829a)),
    iso: num(sub.get(0x8827)),
    date: text(sub.get(0x9003)),
  };
  return Object.values(exif).some((v) => v !== undefined) ? exif : null;
}

/** "NIKON CORPORATION" + "NIKON Z f" → "Nikon Z f". */
export function cameraName(e: PhotoExif): string | undefined {
  const model = e.model?.replace(/^NIKON\b/i, "Nikon");
  if (!model) return undefined;
  const brand = e.make?.split(/\s+/)[0];
  return brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand[0]}${brand.slice(1).toLowerCase()} ${model}` : model;
}

/** The maker as a wordmark: "NIKON CORPORATION" → "NIKON", "FUJIFILM" → "FUJIFILM". */
export function brandName(e: PhotoExif): string | undefined {
  const word = (e.make ?? e.model)?.trim().split(/\s+/)[0];
  return word ? word.toUpperCase() : undefined;
}

/** The model without the maker: "NIKON Z f" → "Z f". */
export function modelName(e: PhotoExif): string | undefined {
  const model = e.model?.trim();
  const brand = brandName(e);
  if (!model) return undefined;
  return brand && model.toUpperCase().startsWith(`${brand} `) ? model.slice(brand.length + 1).trim() : model;
}

const trim = (n: number) => String(Number(n.toFixed(1)));

export function shutterText(s: number): string {
  if (s >= 0.3) return `${trim(s)}s`;
  return `1/${Math.round(1 / s)}s`;
}

/** ["35mm", "f/2", "1/250s", "ISO 200"], whichever are known. */
export function settingsParts(e: PhotoExif): string[] {
  return [
    e.focal ? `${trim(e.focal)}mm` : "",
    e.fNumber ? `f/${trim(e.fNumber)}` : "",
    e.exposure ? shutterText(e.exposure) : "",
    e.iso ? `ISO ${e.iso}` : "",
  ].filter(Boolean);
}

/** "2026.10.09" from the camera's "2026:10:09 14:03:22". */
export function dateText(e: PhotoExif): string | undefined {
  const m = e.date?.match(/^(\d{4}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : undefined;
}
