import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeLook } from "../src/look";
import { defaultParams, paramsToBytes } from "../src/np3/recipe";
import { describeCommunityFile } from "../src/recipeSources";
import { bytesToBase64 } from "../src/storage";

// In-memory localStorage for the store.
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

const np3 = (name: string, saturation = 0) => paramsToBytes(name, { ...defaultParams(), saturation });

interface Repo {
  commit: string;
  files: Record<string, Uint8Array>;
}

async function hashOf(bytes: Uint8Array) {
  const { sha256Base64 } = await import("../src/community");
  return sha256Base64(bytes);
}

/** Fake GitHub commit API, jsDelivr listing and raw GitHub; records file downloads. */
function serve(repos: Record<string, Repo>) {
  const downloads: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    let m = url.match(/api\.github\.com\/repos\/(.+?)\/commits\/main/);
    if (m) return new Response(repos[m[1]].commit);
    m = url.match(/data\.jsdelivr\.com\/v1\/packages\/gh\/(.+?)@(\w+)\?structure=flat/);
    if (m) {
      const repo = repos[m[1]];
      const files = await Promise.all(Object.entries(repo.files).map(async ([p, b]) => ({ name: `/${p}`, hash: await hashOf(b), size: b.length })));
      return Response.json({ files: [...files, { name: "/README.md", hash: "x", size: 1 }] });
    }
    m = url.match(/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/(\w+)\/(.+)$/);
    if (m) {
      const path = m[3].split("/").map(decodeURIComponent).join("/");
      downloads.push(path);
      const bytes = repos[m[1]].files[path];
      return bytes ? new Response(bytes as Uint8Array<ArrayBuffer>) : new Response("", { status: 404 });
    }
    return new Response("", { status: 404 });
  });
  return downloads;
}

describe("community downloads", () => {
  beforeEach(() => {
    mem.clear();
    vi.resetModules();
  });

  it("downloads every source, then only what changed", async () => {
    const shared = np3("Shared");
    const repos: Record<string, Repo> = {
      "shouryan01/Nikon-Recipes": {
        commit: "a".repeat(40),
        files: { "Nikon Creators/MOSS_Nagisa.NP3": np3("MOSS"), "Color Grading/Dup.NP3": shared },
      },
      "vanlong20it/recipe-note": {
        commit: "b".repeat(40),
        files: { "assets/presets/serbanjpg/Kodacolor-S.np3": np3("Kodacolor S", 30), "assets/presets/serbanjpg/Copy.np3": shared },
      },
    };
    const downloads = serve(repos);
    const community = await import("../src/community");

    const first = await community.downloadCommunityRecipes();
    // The byte-identical copy in the second source is kept once.
    expect(first!.map((r) => r.id).sort()).toEqual([
      "community:Color Grading/Dup.NP3",
      "community:Nikon Creators/MOSS_Nagisa.NP3",
      "community:serbanjpg/Kodacolor-S.np3",
    ]);
    expect(downloads).toHaveLength(3);

    const moss = first!.find((r) => r.id.includes("MOSS"))!;
    expect(moss.title).toBe("MOSS");
    expect(moss.author).toBe("Nagisa Ichikawa");
    expect(moss.use).toMatchObject({ ko: expect.stringContaining("식물") });
    const koda = first!.find((r) => r.id.includes("Kodacolor"))!;
    expect(koda.author).toBe("SerbanJPG");
    expect(koda.tags).toEqual(expect.arrayContaining(["serbanjpg", "film", "vivid"]));
    expect(community.communityInfo.value!.sources.map((s) => s.count)).toEqual([2, 1]);

    // Same commits: nothing to do.
    expect(await community.downloadCommunityRecipes()).toBeNull();

    // A new commit that changes one file downloads just that file.
    repos["vanlong20it/recipe-note"].commit = "c".repeat(40);
    repos["vanlong20it/recipe-note"].files["assets/presets/serbanjpg/Kodacolor-S.np3"] = np3("Kodacolor S", 40);
    downloads.length = 0;
    const third = await community.downloadCommunityRecipes();
    expect(downloads).toEqual(["assets/presets/serbanjpg/Kodacolor-S.np3"]);
    expect(third).toHaveLength(3);
  });

  it("reuses 0.2.0's stored files instead of downloading them again", async () => {
    const moss = np3("MOSS");
    mem.set(
      "nikonpclab.community",
      JSON.stringify({
        repo: "shouryan01/Nikon-Recipes",
        commit: "old",
        fetchedAt: "2026-01-01T00:00:00Z",
        files: [{ path: "Nikon Creators/MOSS_Nagisa.NP3", b64: bytesToBase64(moss) }],
      }),
    );
    const downloads = serve({
      "shouryan01/Nikon-Recipes": { commit: "d".repeat(40), files: { "Nikon Creators/MOSS_Nagisa.NP3": moss } },
      "vanlong20it/recipe-note": { commit: "e".repeat(40), files: { "assets/presets/serbanjpg/LUX-Brass.np3": np3("LUX Brass") } },
    });
    const community = await import("../src/community");
    expect(community.storedCommunityRecipes.map((r) => r.id)).toEqual(["community:Nikon Creators/MOSS_Nagisa.NP3"]);

    const recipes = await community.downloadCommunityRecipes();
    expect(downloads).toEqual(["assets/presets/serbanjpg/LUX-Brass.np3"]);
    expect(recipes).toHaveLength(2);
    expect(mem.has("nikonpclab.community")).toBe(false);
    expect(JSON.parse(mem.get("nikonpclab.community2")!).v).toBe(2);
  });

  it("keeps a source it couldn't reach", async () => {
    const repos: Record<string, Repo> = {
      "shouryan01/Nikon-Recipes": { commit: "f".repeat(40), files: { "NikonPC/Kodachrome.NP3": np3("Kodachrome") } },
      "vanlong20it/recipe-note": { commit: "1".repeat(40), files: { "assets/presets/serbanjpg/Juniper.np3": np3("Juniper") } },
    };
    serve(repos);
    const community = await import("../src/community");
    await community.downloadCommunityRecipes();
    // The second repository disappears; its recipes stay.
    delete (repos as Partial<typeof repos>)["vanlong20it/recipe-note"];
    repos["shouryan01/Nikon-Recipes"].commit = "2".repeat(40);
    const next = await community.downloadCommunityRecipes();
    expect(next!.map((r) => r.id)).toContain("community:serbanjpg/Juniper.np3");
  });
});

describe("recipe concepts", () => {
  it("reads mono, warmth, saturation and contrast from the values", () => {
    expect(analyzeLook({ ...defaultParams(), saturation: -100 }).tags).toContain("mono");
    const warm = analyzeLook({
      ...defaultParams(),
      saturation: 35,
      contrast: 60,
      colorGrading: { blending: 50, balance: 0, midTone: { hue: 35, chroma: 30, brightness: 0 } },
    });
    expect(warm.tags).toEqual(["warm", "vivid", "contrasty"]);
    expect(warm.summary.en).toBe("warm · vivid · punchy contrast");
    const cool = analyzeLook({
      ...defaultParams(),
      saturation: -30,
      colorGrading: { blending: 50, balance: 0, shadows: { hue: 210, chroma: 40, brightness: 0 } },
    });
    expect(cool.tags).toEqual(["cool", "muted"]);
    expect(analyzeLook({ ...defaultParams(), clarity: 0.5 }).summary.ko).toBe("자연스러운 기본 톤");
    // B&W recipes named as such count as mono even when the values don't show it.
    expect(analyzeLook(defaultParams(), true).summary.en).toBe("black & white");
  });

  it("spots a matte film curve", () => {
    const raw = Array.from({ length: 257 }, (_, i) => Math.round(3000 + (i / 256) * (32767 - 3000)));
    const look = analyzeLook({ ...defaultParams(), toneCurve: { raw, points: [] } });
    expect(look.tags).toContain("film");
  });

  it("names SerbanJPG files", () => {
    expect(describeCommunityFile("Modern-Chrome-Std.np3", "serbanjpg")).toEqual({
      title: "Modern Chrome Std",
      creator: "SerbanJPG",
      tags: ["serbanjpg", "film"],
    });
    expect(describeCommunityFile("LUX-B-W-HC.np3", "serbanjpg").tags).toContain("mono");
  });
});
