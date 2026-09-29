import { deserialize } from "nikon-flexible-color-picture-control";
import { describe, expect, it } from "vitest";
import {
  normalizeParams,
  paramsToBytes,
  parseNp3,
  recipeToBytes,
  sanitizeNpName,
  withNpName,
  type Recipe,
  type RecipeParams,
} from "../src/np3/recipe";
import { toneCurveFromPoints } from "../src/np3/toneCurve";

const sample: RecipeParams = normalizeParams({
  sharpning: 1.5,
  midRangeSharpning: -0.75,
  clarity: 1.25,
  contrast: -12,
  highlights: -30,
  shadows: 18,
  whiteLevel: 5,
  blackLevel: 10,
  saturation: -8,
  colorBlender: { red: { hue: 6, chroma: -10, brightness: 3 }, blue: { hue: -12, chroma: 20, brightness: -5 } },
  colorGrading: { highlights: { hue: 45, chroma: 12, brightness: 0 }, shadows: { hue: 210, chroma: 9, brightness: -4 }, blending: 60, balance: -10 },
  comment: "테스트 comment",
});

describe("NP3 encoding", () => {
  it("round-trips every parameter through serialize/deserialize", () => {
    const bytes = paramsToBytes("TEST_RECIPE", sample);
    const parsed = parseNp3(bytes);
    expect(parsed.npName).toBe("TEST_RECIPE");
    expect(parsed.params).toEqual(sample);
  });

  it("round-trips a tone curve and zeroes the tone sliders like the format does", () => {
    const withCurve = normalizeParams({ ...sample, toneCurve: toneCurveFromPoints([{ x: 0, y: 20 }, { x: 128, y: 120 }, { x: 255, y: 250 }]) });
    expect(withCurve.contrast).toBe(0);
    const parsed = parseNp3(paramsToBytes("CURVE", withCurve));
    expect(parsed.params?.toneCurve?.points).toEqual([{ x: 0, y: 20 }, { x: 128, y: 120 }, { x: 255, y: 250 }]);
    expect(parsed.params?.toneCurve?.raw).toEqual(withCurve.toneCurve!.raw);
    expect(parsed.params?.comment).toBe("테스트 comment");
  });

  it("writes the NCP magic and flexible-color version header", () => {
    const bytes = paramsToBytes("HDR", sample);
    expect(String.fromCharCode(...bytes.slice(0, 3))).toBe("NCP");
    expect(String.fromCharCode(...bytes.slice(12, 16))).toBe("0310");
  });

  it("snaps values to what the file can store", () => {
    const p = normalizeParams({ sharpning: 1.3, contrast: 12.6, saturation: 400, colorGrading: { highlights: { hue: -30, chroma: 5 } } });
    expect(p.sharpning).toBe(1.25);
    expect(p.contrast).toBe(13);
    expect(p.saturation).toBe(100);
    expect(p.colorGrading?.highlights?.hue).toBe(330);
    const decoded = deserialize(paramsToBytes("SNAP", p));
    expect(decoded.sharpning).toBe(1.25);
  });

  it("passes imported bytes through untouched", () => {
    const raw = paramsToBytes("ORIGINAL", sample);
    const recipe: Recipe = { id: "x", source: "imported", title: "x", npName: "RENAMED", tags: [], params: sample, raw };
    expect(recipeToBytes(recipe)).toBe(raw);
  });

  it("rejects files that are not picture controls", () => {
    expect(() => parseNp3(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]))).toThrow();
  });

  it("keeps unknown-version files packable without params", () => {
    const bytes = paramsToBytes("OLD", sample);
    bytes.set([0x30, 0x31, 0x30, 0x30], 12);
    const parsed = parseNp3(bytes);
    expect(parsed.params).toBeNull();
    expect(parsed.npName).toBe("OLD");
  });

  it("renames a file without touching any other byte", () => {
    const original = paramsToBytes("OLD_NAME_LONGER", sample);
    const renamed = withNpName(original, "NEW");
    expect(parseNp3(renamed).npName).toBe("NEW");
    expect(parseNp3(renamed).params).toEqual(parseNp3(original).params);
    const changed = [...renamed].map((b, i) => (b !== original[i] ? i : -1)).filter((i) => i >= 0);
    expect(changed.every((i) => i >= 24 && i < 44)).toBe(true);
  });

  it("sanitizes camera names", () => {
    expect(sanitizeNpName("따뜻한 필름")).toBe("RECIPE");
    expect(sanitizeNpName("Café Film/400!")).toBe("Cafe Film_400");
    expect(sanitizeNpName("A".repeat(30))).toHaveLength(19);
  });
});
