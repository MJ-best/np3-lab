// Card and export rules shared by the Mac app (electron/) and the Android bridge (src/androidBridge.ts).
// Pure: no Node or browser APIs, so both can import it.

/**
 * Decide from a volume's top-level names (and its DCIM sub-folders) whether it is
 * a Nikon card. A freshly formatted card may have an empty DCIM, which is accepted;
 * a DCIM holding only other brands' folders (100CANON, 100MSDCF, 100_FUJI …) is not.
 * @param {string[]} rootNames
 * @param {string[] | null} dcimNames
 */
export function looksLikeNikonCard(rootNames, dcimNames) {
  const upper = rootNames.map((n) => n.toUpperCase());
  if (upper.includes("NIKON")) return true;
  if (upper.some((n) => /^NIKON\d{3}\.DSC$/.test(n))) return true;
  if (!upper.includes("DCIM")) return false;
  const folders = (dcimNames ?? []).filter((n) => /^\d{3}/.test(n));
  if (folders.length === 0) return true;
  return folders.some((n) => /^\d{3}N/i.test(n));
}

/**
 * A file name the page may write or delete: a plain *.NP3 name inside CUSTOMPC, any characters.
 * @param {unknown} name
 * @returns {name is string}
 */
export function isSafeNp3Name(name) {
  return (
    typeof name === "string" &&
    name.length >= 5 &&
    name.length <= 255 &&
    /\.np3$/i.test(name) &&
    !name.startsWith(".") &&
    !/[\\/\0]/.test(name)
  );
}

/** NP3 files are about 1 KB; nothing larger is accepted from or written to a card. */
export const MAX_NP3_BYTES = 64 * 1024;

/**
 * Bytes that start like a Picture Control file ("NCP\0" + version) and have a sane size.
 * Whatever reaches the camera must at least pass this.
 * @param {unknown} bytes
 * @returns {bytes is Uint8Array}
 */
export function isNp3Bytes(bytes) {
  return (
    bytes instanceof Uint8Array &&
    bytes.length >= 32 &&
    bytes.length <= MAX_NP3_BYTES &&
    bytes[0] === 0x4e &&
    bytes[1] === 0x43 &&
    bytes[2] === 0x50 &&
    bytes[3] === 0x00
  );
}

/** 2026-10-01 → "20261001" (local time). */
export function dateTag(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
}

/**
 * A single safe path segment: no separators, no "..", nothing Finder or FAT would reject.
 * @param {string} name
 */
export function safeSegment(name) {
  const s = String(name)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 80);
  return s || "_";
}

/** @param {Uint8Array} a @param {Uint8Array} b */
export const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Names for exporting `<base><ext>` without overwriting: `family` matches the name and its
 * dated copies (`<base>_YYYYMMDD[-n]`), `candidates` are the names to try in order.
 * @param {string} base
 * @param {string} ext
 * @param {string} tag
 */
export function exportNames(base, ext, tag) {
  const family = new RegExp(`^${escapeRe(base)}(?:_\\d{8}(?:-\\d+)?)?${escapeRe(ext)}$`, "i");
  const candidates = [`${base}${ext}`, `${base}_${tag}${ext}`];
  for (let n = 2; n < 1000; n++) candidates.push(`${base}_${tag}-${n}${ext}`);
  return { family, candidates };
}
