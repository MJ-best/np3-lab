import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dateTag, exportRecipes, safeSegment, writeWithoutOverwrite } from "../electron/exportFiles.mjs";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "np3-export-"));
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const bytes = (...v: number[]) => new Uint8Array(v);
const list = async (d = dir) => (await readdir(d)).sort();

describe("exporting without overwriting", () => {
  it("writes new files, skips unchanged ones and dates changed ones", async () => {
    expect(await writeWithoutOverwrite(dir, "MOSS", bytes(1, 2), { tag: "20261001" })).toEqual({ status: "written", name: "MOSS.NP3" });
    // Same contents again: nothing happens.
    expect((await writeWithoutOverwrite(dir, "MOSS", bytes(1, 2), { tag: "20261001" })).status).toBe("unchanged");
    // The user edited MOSS.NP3 (or a different recipe has the same name): keep it, add the date.
    await writeFile(join(dir, "MOSS.NP3"), bytes(9, 9));
    expect(await writeWithoutOverwrite(dir, "MOSS", bytes(1, 2), { tag: "20261001" })).toEqual({ status: "renamed", name: "MOSS_20261001.NP3" });
    expect(await readFile(join(dir, "MOSS.NP3"))).toEqual(Buffer.from([9, 9]));
    // A third version the same day.
    expect((await writeWithoutOverwrite(dir, "MOSS", bytes(3), { tag: "20261001" })).name).toBe("MOSS_20261001-2.NP3");
    expect(await list()).toEqual(["MOSS.NP3", "MOSS_20261001-2.NP3", "MOSS_20261001.NP3"]);
  });

  it("doesn't make a new dated copy on a later day when the contents are the same", async () => {
    await writeFile(join(dir, "MOSS.NP3"), bytes(9));
    await writeWithoutOverwrite(dir, "MOSS", bytes(1), { tag: "20261001" });
    expect((await writeWithoutOverwrite(dir, "MOSS", bytes(1), { tag: "20261002" })).status).toBe("unchanged");
    expect(await list()).toEqual(["MOSS.NP3", "MOSS_20261001.NP3"]);
  });

  it("treats names case-insensitively and leaves other recipes alone", async () => {
    await writeFile(join(dir, "moss.np3"), bytes(9));
    await writeFile(join(dir, "MOSS_Nagisa.NP3"), bytes(1));
    expect((await writeWithoutOverwrite(dir, "MOSS", bytes(1), { tag: "20261001" })).name).toBe("MOSS_20261001.NP3");
  });

  it("exports into safe sub-folders and counts the outcome", async () => {
    const files = [
      { dir: "Community/Nikon Creators", base: "MOSS_Nagisa", bytes: bytes(1) },
      { dir: "My Recipes", base: "Mine", bytes: bytes(2) },
      { dir: "My Recipes", base: "Mine", bytes: bytes(3) },
      { dir: "../../etc", base: "../evil", bytes: bytes(4) },
    ];
    expect(await exportRecipes(dir, files, "20261001")).toEqual({ written: 3, renamed: 1, unchanged: 0, failed: 0 });
    expect(await list(join(dir, "My Recipes"))).toEqual(["Mine.NP3", "Mine_20261001.NP3"]);
    expect(await list(join(dir, "_", "_", "etc"))).toEqual(["_evil.NP3"]);
    expect(await exportRecipes(dir, files, "20261002")).toEqual({ written: 0, renamed: 0, unchanged: 4, failed: 0 });
  });

  it("formats the date and cleans names", () => {
    expect(dateTag(new Date(2026, 9, 1))).toBe("20261001");
    expect(safeSegment("a/b:c")).toBe("a_b_c");
    expect(safeSegment("..")).toBe("_");
  });
});
