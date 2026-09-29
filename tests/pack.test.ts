import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseNp3, type Recipe } from "../src/np3/recipe";
import { manifestText, planCardFiles, picconName } from "../src/pack/naming";
import { buildZip } from "../src/pack/zip";

const make = (n: number): Recipe[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    source: "builtin",
    title: { ko: `레시피 ${i}`, en: `Recipe ${i}` },
    npName: `RECIPE_${i}`,
    tags: [],
    params: { contrast: i % 100 },
  }));

describe("card file planning", () => {
  it("numbers PICCON files from 01", () => {
    const plan = planCardFiles(make(3), { mode: "piccon" });
    expect(plan.files.map((f) => f.fileName)).toEqual(["PICCON01.NP3", "PICCON02.NP3", "PICCON03.NP3"]);
  });

  it("skips numbers already used on the card (case-insensitive)", () => {
    const plan = planCardFiles(make(3), { mode: "piccon", existing: ["piccon01.np3", "PICCON03.NP3", "NCSET001.BIN"] });
    expect(plan.files.map((f) => f.fileName)).toEqual(["PICCON02.NP3", "PICCON04.NP3", "PICCON05.NP3"]);
  });

  it("stops at 99 files including ones already on the card", () => {
    const existing = ["FOO.NP3", "BAR.NP3"];
    const plan = planCardFiles(make(100), { mode: "piccon", existing });
    expect(plan.files).toHaveLength(97);
    expect(plan.overflow).toHaveLength(3);
    expect(plan.files.at(-1)?.fileName).toBe(picconName(97));
  });

  it("uses recipe names without collisions in name mode", () => {
    const recipes = make(2).map((r) => ({ ...r, npName: "Warm Film" }));
    const plan = planCardFiles(recipes, { mode: "name", existing: ["WARM_FILM.NP3"] });
    expect(plan.files.map((f) => f.fileName)).toEqual(["Warm_Film_2.NP3", "Warm_Film_3.NP3"]);
  });

  it("writes a readable manifest", () => {
    const plan = planCardFiles(make(1), { mode: "piccon" });
    expect(manifestText([plan.files])).toContain("PICCON01.NP3");
  });
});

describe("zip packaging", () => {
  it("lays files out as NIKON/CUSTOMPC with a LIST.txt", async () => {
    const { data } = await buildZip(make(3), { mode: "piccon" });
    const zip = await JSZip.loadAsync(data);
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
    expect(names).toEqual(["LIST.txt", "NIKON/CUSTOMPC/PICCON01.NP3", "NIKON/CUSTOMPC/PICCON02.NP3", "NIKON/CUSTOMPC/PICCON03.NP3"]);
    const bytes = await zip.file("NIKON/CUSTOMPC/PICCON02.NP3")!.async("uint8array");
    expect(parseNp3(bytes).npName).toBe("RECIPE_1");
    expect(parseNp3(bytes).params?.contrast).toBe(1);
  });

  it("splits into one folder per card above 99 recipes", async () => {
    const { data, cards } = await buildZip(make(120), { mode: "piccon" });
    expect(cards.map((c) => c.length)).toEqual([99, 21]);
    const zip = await JSZip.loadAsync(data);
    expect(zip.file("CARD-1/NIKON/CUSTOMPC/PICCON99.NP3")).not.toBeNull();
    expect(zip.file("CARD-2/NIKON/CUSTOMPC/PICCON21.NP3")).not.toBeNull();
  });
});
