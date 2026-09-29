// Which mounted volumes are Nikon memory cards. Pure helpers are exported for tests.
import { basename } from "node:path";

/** Camera cards are always FAT32 or exFAT; everything else (APFS/HFS drives, network shares) is ignored. */
export const CARD_FILESYSTEMS = new Set(["msdos", "exfat", "vfat", "fat32"]);

/**
 * Parse macOS `mount` output into /Volumes mount points with their file system.
 * Example line: "/dev/disk4s1 on /Volumes/NIKON Z 8 (exfat, local, nodev, nosuid, noowners)".
 * `mount` reads the kernel table without touching the file systems, so a stalled
 * network share can't block it.
 */
export function parseMacMounts(stdout) {
  const out = [];
  for (const line of stdout.split("\n")) {
    // Greedy path match: the file-system list is the last " (" group on the line.
    const m = /^.+? on (\/Volumes\/.+) \(([^,)]+)/.exec(line);
    if (!m) continue;
    out.push({ path: m[1], name: basename(m[1]), fsType: m[2].trim().toLowerCase() });
  }
  return out;
}

/**
 * Decide from a volume's top-level names (and its DCIM sub-folders) whether it is
 * a Nikon card. A freshly formatted card may have an empty DCIM, which is accepted;
 * a DCIM holding only other brands' folders (100CANON, 100MSDCF, 100_FUJI …) is not.
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

/** Resolve to `fallback` if `promise` takes longer than `ms`. */
export function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

/** A file name the renderer may write or trash: a plain *.NP3 name inside CUSTOMPC, any characters. */
export function isSafeNp3Name(name) {
  return (
    typeof name === "string" &&
    name.length >= 5 &&
    name.length <= 255 &&
    /\.np3$/i.test(name) &&
    !name.startsWith(".") &&
    !/[\\/\0]/.test(name) &&
    basename(name) === name
  );
}
