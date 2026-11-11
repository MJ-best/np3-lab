import { describe, expect, it } from "vitest";
import { isSafeNp3Name } from "../electron/cardRules.mjs";
import { ncpBytes, ncpToParams, parseNcp, toNcp, type NcpParams } from "../src/np3/ncp";
import { defaultParams, normalizeParams, paramsToBytes, parseNp3, pcExt, pcFormat, withNpName, type Recipe } from "../src/np3/recipe";
import { RAW_MAX } from "../src/np3/toneCurve";
import { planCardFiles } from "../src/pack/naming";

const linear = Array.from({ length: 257 }, (_, i) => Math.round((i / 256) * RAW_MAX));
const color: NcpParams = { mono: false, sharpening: 5, saturation: -1, hue: 1, filter: 0, toning: 0, curve: linear, points: [{ x: 0, y: 12 }, { x: 255, y: 240 }] };

describe("original Picture Control (.NCP)", () => {
  it("writes Nikon's 638-byte layout and reads it back", () => {
    const b = ncpBytes("PORTRA LIKE", color);
    expect(b.length).toBe(638);
    expect(String.fromCharCode(...b.slice(0, 3), ...b.slice(12, 16))).toBe("NCP0100");
    expect(String.fromCharCode(...b.slice(16, 27))).toBe("PORTRA LIKE");
    expect([...b.slice(0x24, 0x30)]).toEqual([0x03, 0xc2, 0x02, 0xff, 0x85, 0x01, 0x01, 0x7f, 0x81, 0xff, 0xff, 0xff]);
    expect(parseNcp(b)).toEqual(color);
  });

  it("writes monochrome with its filter and without colour sliders", () => {
    const mono = { ...color, mono: true, saturation: 0, hue: 0, filter: 1 };
    const b = ncpBytes("TMAX", mono);
    expect([...b.slice(0x24, 0x30)]).toEqual([0x06, 0x4d, 0x00, 0xff, 0x85, 0x01, 0x01, 0xff, 0xff, 0x81, 0x80, 0xff]);
    expect(parseNcp(b)).toEqual(mono);
  });

  it("is told apart from Flexible Color, named and renamed in its own place", () => {
    const b = ncpBytes("GOLD 100", color);
    expect(pcFormat(b)).toBe("ncp");
    expect(pcExt(b)).toBe(".NCP");
    expect(pcFormat(paramsToBytes("X", defaultParams()))).toBe("flexible");
    const parsed = parseNp3(b);
    expect(parsed.npName).toBe("GOLD 100");
    expect(parsed.params?.toneCurve?.raw).toEqual(linear);
    const renamed = withNpName(b, "GOLD 200");
    expect(parseNp3(renamed).npName).toBe("GOLD 200");
    // Only the name changes.
    expect([...renamed].filter((v, i) => v !== b[i]).length).toBe(1);
  });

  it("keeps .NCP and .NP2 names safe to write, like .NP3", () => {
    expect(isSafeNp3Name("PICCON01.NCP")).toBe(true);
    expect(isSafeNp3Name("Kodak Gold.np2")).toBe(true);
    expect(isSafeNp3Name("x.ncp.txt")).toBe(false);
  });

  it("numbers each file type on the card separately (up to 99 each)", () => {
    const np3: Recipe = { id: "a", source: "mine", title: "A", npName: "A", tags: [], params: defaultParams() };
    const ncp: Recipe = { ...np3, id: "b", raw: ncpBytes("B", color) };
    const plan = planCardFiles([np3, ncp, ncp], { mode: "piccon", existing: ["PICCON01.NCP"] });
    expect(plan.files.map((f) => f.fileName)).toEqual(["PICCON01.NP3", "PICCON02.NCP", "PICCON03.NCP"]);
  });
});

describe("Flexible Color → original Picture Control", () => {
  it("keeps a neutral recipe neutral", () => {
    const n = toNcp(defaultParams());
    expect(n.mono).toBe(false);
    expect(n.saturation).toBe(0);
    n.curve.forEach((v, i) => expect(Math.abs(v - linear[i])).toBeLessThan(40));
  });

  it("turns tone sliders into the curve and keeps saturation in classic steps", () => {
    const n = toNcp(normalizeParams({ ...defaultParams(), contrast: 40, highlights: -50, saturation: 40 }));
    // More contrast: darker quarter tones, brighter three-quarter tones; pulled highlights stay below white.
    expect(n.curve[64]).toBeLessThan(linear[64]);
    expect(n.curve[192]).toBeGreaterThan(linear[192] - 2000);
    expect(n.curve[256]).toBeLessThanOrEqual(RAW_MAX);
    expect(n.saturation).toBe(1);
  });

  it("uses a recipe's own tone curve as is", () => {
    const curve = linear.map((v) => Math.round(v * 0.9));
    const n = toNcp(normalizeParams({ ...defaultParams(), toneCurve: { raw: curve, points: [{ x: 0, y: 0 }, { x: 255, y: 230 }] } }));
    expect(n.curve).toEqual(curve);
  });

  it("makes black & white recipes monochrome, with the filter their blender comes closest to", () => {
    const n = toNcp(
      normalizeParams({
        ...defaultParams(),
        saturation: -100,
        colorBlender: { red: { hue: 0, chroma: 0, brightness: 40 }, orange: { hue: 0, chroma: 0, brightness: 30 }, blue: { hue: 0, chroma: 0, brightness: -40 } },
      }),
    );
    expect(n.mono).toBe(true);
    expect(n.filter).toBe(2);
  });

  it("previews a converted recipe the way it is written", () => {
    const p = normalizeParams({ ...defaultParams(), contrast: -20, saturation: -30 });
    const view = ncpToParams(toNcp(p));
    expect(view.toneCurve?.raw).toEqual(toNcp(p).curve);
    expect(view.saturation).toBeCloseTo(-100 / 3);
    expect(view.colorBlender).toEqual({});
  });
});
