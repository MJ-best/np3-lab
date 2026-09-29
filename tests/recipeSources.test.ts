import { describe, expect, it } from "vitest";
import { communitySourceUrl, describeCommunityFile } from "../src/recipeSources";

describe("community recipe metadata", () => {
  it("splits Nikon creator recipes into title and creator", () => {
    expect(describeCommunityFile("Nikon Creators/CallItLove_Faloo Mi.NP3")).toEqual({
      title: "CallItLove",
      creator: "Faloo Mi",
      tags: ["nikon-creators"],
    });
    expect(describeCommunityFile("Nikon Creators/CineBias-BB.NP3").creator).toBe("Nikon");
  });

  it("tags black & white recipes as mono", () => {
    expect(describeCommunityFile("Nikon Creators/BritFilmBW_Vincent.NP3").tags).toEqual(["nikon-creators", "mono"]);
    expect(describeCommunityFile("Third Party Creators/Mark G Adams/Nikon B&W Recipes/MGA TriX.NP3")).toEqual({
      title: "MGA TriX",
      creator: "Mark G Adams",
      tags: ["third-party", "mono"],
    });
  });

  it("handles Nikon presets, NikonPC and independent creators", () => {
    expect(describeCommunityFile("Color Grading/BleachBypass_01a.NP3")).toEqual({
      title: "BleachBypass_01a",
      creator: "Nikon",
      tags: ["color-grading"],
    });
    expect(describeCommunityFile("NikonPC/Kodachrome.NP3").creator).toBe("nikonpc.com");
    expect(describeCommunityFile("Third Party Creators/Ross And His JPEGs/A-X+rossandhisjpegs.NP3")).toEqual({
      title: "A-X",
      creator: "Ross And His JPEGs",
      tags: ["third-party"],
    });
  });

  it("links to the pinned source file", () => {
    expect(communitySourceUrl("o/r", "abc", "Nikon Creators/At Dusk_Woo.NP3")).toBe(
      "https://github.com/o/r/blob/abc/Nikon%20Creators/At%20Dusk_Woo.NP3",
    );
  });
});
