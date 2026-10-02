// Finds NP3 files on this Mac — e.g. Picture Controls exported from NX Studio —
// without the user having to know where they were saved.
import { execFile } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

/** NP3 files are about 1 KB; anything much bigger isn't one. */
export const MAX_NP3_BYTES = 64 * 1024;
export const MAX_RESULTS = 100;

/**
 * Paths we never offer: cards (synced separately), the Trash and app data.
 * @param {string} path
 * @param {{ home?: string, extra?: string[] }} [options]
 */
export function isExcludedPath(path, { home = homedir(), extra = [] } = {}) {
  if (path.startsWith(nikonSupportDir(home) + sep)) return false;
  const prefixes = [`/Volumes${sep}`, join(home, ".Trash") + sep, join(home, "Library") + sep, "/private/", "/System/", ...extra];
  if (prefixes.some((p) => path.startsWith(p))) return true;
  return path.split(sep).some((part) => part === "node_modules" || (part.startsWith(".") && part.length > 1));
}

/** NX Studio keeps its own presets here (UserPreset); Spotlight may not index Library. */
export const nikonSupportDir = (home = homedir()) => join(home, "Library", "Application Support", "Nikon");

/** Spotlight output: one absolute path per line; keep NP3 files only. */
export function parseMdfindOutput(stdout) {
  return [...new Set(stdout.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("/") && /\.np3$/i.test(l)))];
}

/** Header "NCP\0"; both Flexible Color (0310) and older Picture Controls are accepted here. */
export const looksLikeNp3 = (bytes) => bytes.length >= 16 && bytes[0] === 0x4e && bytes[1] === 0x43 && bytes[2] === 0x50;

async function spotlight() {
  const { stdout } = await execFileP("/usr/bin/mdfind", ["kMDItemFSName == '*.np3'c"], { timeout: 8000, maxBuffer: 8 * 1024 * 1024 });
  return parseMdfindOutput(stdout);
}

/** Without Spotlight (disabled, or not a Mac): look a few levels into the given folders. */
async function scanFolders(roots, depth = 4) {
  const found = [];
  const walk = async (dir, level) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const p = join(dir, e.name);
      if (e.isDirectory() && level < depth && e.name !== "node_modules") await walk(p, level + 1);
      else if (e.isFile() && /\.np3$/i.test(e.name)) found.push(p);
    }
  };
  for (const root of roots) await walk(root, 1);
  return found;
}

/**
 * NP3 files on this computer, newest first, with their bytes.
 * `sinceMs` limits the result to files modified after that time.
 */
export async function findLocalNp3({ sinceMs = 0, exclude = [] } = {}) {
  const home = homedir();
  const common = ["Downloads", "Desktop", "Documents", "Pictures"].map((d) => join(home, d));
  let paths;
  try {
    paths = process.platform === "darwin" ? await spotlight() : await scanFolders(common);
  } catch {
    paths = await scanFolders(common);
  }
  paths = [...new Set([...paths, ...(await scanFolders([nikonSupportDir(home)], 5))])];
  const candidates = [];
  for (const path of paths) {
    if (isExcludedPath(path, { home, extra: exclude })) continue;
    try {
      const s = await stat(path);
      if (!s.isFile() || s.size > MAX_NP3_BYTES || s.mtimeMs <= sinceMs) continue;
      candidates.push({ path, mtimeMs: s.mtimeMs });
    } catch {
      /* gone since Spotlight indexed it */
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const out = [];
  for (const c of candidates.slice(0, MAX_RESULTS)) {
    try {
      const bytes = new Uint8Array(await readFile(c.path));
      if (!looksLikeNp3(bytes)) continue;
      // The page gets the file name only; it has no use for where things live on disk.
      out.push({ name: c.path.split(sep).pop(), mtimeMs: c.mtimeMs, bytes });
    } catch {
      /* unreadable */
    }
  }
  return out;
}
