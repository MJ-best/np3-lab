import { describe, expect, it } from "vitest";
import { isExcludedPath, looksLikeNp3, parseMdfindOutput } from "../electron/localNp3.mjs";

describe("finding NP3 files on the Mac", () => {
  it("keeps NP3 paths from Spotlight output", () => {
    expect(parseMdfindOutput("/Users/a/Downloads/Look.NP3\n/Users/a/x.np3\n\n/Users/a/x.np3\n/Users/a/notes.txt\n2026 mdfind warning\n")).toEqual([
      "/Users/a/Downloads/Look.NP3",
      "/Users/a/x.np3",
    ]);
  });

  it("skips cards, the Trash, Library, hidden folders and app data, but not NX Studio's folder", () => {
    const home = "/Users/a";
    expect(isExcludedPath("/Users/a/Documents/NX/Look.NP3", { home })).toBe(false);
    expect(isExcludedPath("/Volumes/NIKON Z 8/NIKON/CUSTOMPC/PICCON01.NP3", { home })).toBe(true);
    expect(isExcludedPath("/Users/a/.Trash/Old.NP3", { home })).toBe(true);
    expect(isExcludedPath("/Users/a/Library/Caches/x.NP3", { home })).toBe(true);
    expect(isExcludedPath("/Users/a/Library/Application Support/Nikon/NX Studio/UserPreset/Mine.NP3", { home })).toBe(false);
    expect(isExcludedPath("/Users/a/code/.git/x.np3", { home })).toBe(true);
    expect(isExcludedPath("/Users/a/code/app/node_modules/pkg/x.np3", { home })).toBe(true);
    expect(isExcludedPath("/Users/a/Data/NP3 Lab/x.np3", { home, extra: ["/Users/a/Data/NP3 Lab/"] })).toBe(true);
  });

  it("recognises the NP3 header", () => {
    const ok = new Uint8Array(32);
    ok.set([0x4e, 0x43, 0x50, 0]);
    expect(looksLikeNp3(ok)).toBe(true);
    expect(looksLikeNp3(new Uint8Array(32))).toBe(false);
  });
});
