// Exports recipes to a folder without ever overwriting a file that's already there.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** 2026-10-01 → "20261001" (local time). */
export function dateTag(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
}

/** A single safe path segment: no separators, no "..", nothing Finder or FAT would reject. */
export function safeSegment(name) {
  const s = String(name)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 80);
  return s || "_";
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Write `bytes` as `<base><ext>` in `dir`, keeping every existing file:
 * - if the same name or one of its dated copies (`<base>_YYYYMMDD[-n]`) already has
 *   these exact bytes, nothing is written ("unchanged");
 * - if the name is free it's used ("written");
 * - otherwise the date is appended, then -2, -3 … ("renamed").
 * @param {string} dir
 * @param {string} base
 * @param {Uint8Array} bytes
 * @param {{ ext?: string, tag?: string }} [options]
 */
export async function writeWithoutOverwrite(dir, base, bytes, { ext = ".NP3", tag = dateTag() } = {}) {
  await mkdir(dir, { recursive: true });
  const family = new RegExp(`^${escapeRe(base)}(?:_\\d{8}(?:-\\d+)?)?${escapeRe(ext)}$`, "i");
  const names = await readdir(dir);
  const taken = new Set(names.map((n) => n.toLowerCase()));
  for (const name of names.filter((n) => family.test(n))) {
    try {
      if (sameBytes(new Uint8Array(await readFile(join(dir, name))), bytes)) return { status: "unchanged", name };
    } catch {
      /* unreadable: treat as different */
    }
  }
  const candidates = [`${base}${ext}`, `${base}_${tag}${ext}`];
  for (let n = 2; n < 1000; n++) candidates.push(`${base}_${tag}-${n}${ext}`);
  for (const name of candidates) {
    if (taken.has(name.toLowerCase())) continue;
    try {
      // "wx" fails instead of overwriting if the file appeared in the meantime.
      await writeFile(join(dir, name), bytes, { flag: "wx" });
      return { status: name === candidates[0] ? "written" : "renamed", name };
    } catch (err) {
      if (err?.code !== "EEXIST") throw err;
    }
  }
  throw new Error("no-free-name");
}

/**
 * Export many files (`dir` is a relative folder like "Community/Nikon Creators").
 * Returns how many were written, renamed (date added) and skipped as unchanged.
 * @param {string} root
 * @param {{ dir: string, base: string, bytes: Uint8Array }[]} files
 */
export async function exportRecipes(root, files, tag = dateTag()) {
  const result = { written: 0, renamed: 0, unchanged: 0, failed: 0 };
  for (const f of files) {
    const dir = join(root, ...String(f.dir).split("/").filter(Boolean).map(safeSegment));
    try {
      const r = await writeWithoutOverwrite(dir, safeSegment(f.base), f.bytes, { tag });
      result[r.status]++;
    } catch {
      result.failed++;
    }
  }
  return result;
}
