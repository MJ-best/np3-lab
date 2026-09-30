import { describe, expect, it } from "vitest";
import type { Recipe } from "../src/np3/recipe";
import { matchRecipeByExif } from "../src/photos";

const recipe = (id: string, npName: string): Recipe => ({ id, source: "builtin", title: id, npName, tags: [], params: null });
const jpeg = (payload: string, name = "DSC_0001.JPG") =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe1]), `Exif\0\0...Nikon\0...${payload}\0...`], name, { type: "image/jpeg" });

describe("EXIF recipe matching", () => {
  const recipes = [recipe("a", "At Dusk"), recipe("b", "At Dusk_Woo"), recipe("c", "NeonGlow_BrandonW")];

  it("picks the longest camera name found in the maker note", async () => {
    expect((await matchRecipeByExif(jpeg("At Dusk_Woo"), recipes))?.id).toBe("b");
  });

  it("matches names cut to the 19-byte field", async () => {
    expect((await matchRecipeByExif(jpeg("NeonGlow_BrandonW".slice(0, 19)), recipes))?.id).toBe("c");
  });

  it("ignores non-Nikon photos and non-JPEGs", async () => {
    expect(await matchRecipeByExif(new File(["Exif At Dusk_Woo"], "x.jpg", { type: "image/jpeg" }), recipes)).toBeNull();
    expect(await matchRecipeByExif(new File(["Exif Nikon At Dusk_Woo"], "x.png", { type: "image/png" }), recipes)).toBeNull();
  });
});
