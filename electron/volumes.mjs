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
