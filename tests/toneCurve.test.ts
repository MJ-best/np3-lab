import { describe, expect, it } from "vitest";
import { CURVE_PRESETS, cleanPoints, isIdentityCurve, pointsToRaw, toneCurveFromPoints } from "../src/np3/toneCurve";

describe("tone curve", () => {
  it("produces 257 samples spanning the full range for identity", () => {
    const raw = pointsToRaw(CURVE_PRESETS.linear);
    expect(raw).toHaveLength(257);
    expect(raw[0]).toBe(0);
    expect(raw[256]).toBe(32767);
    expect(isIdentityCurve(toneCurveFromPoints(CURVE_PRESETS.linear))).toBe(true);
  });

  it("is monotone for monotone points (no overshoot)", () => {
    for (const preset of Object.values(CURVE_PRESETS)) {
      const raw = pointsToRaw(preset);
      for (let i = 1; i < raw.length; i++) expect(raw[i]).toBeGreaterThanOrEqual(raw[i - 1]);
    }
  });

  it("passes through control points", () => {
    const raw = pointsToRaw([{ x: 0, y: 30 }, { x: 255, y: 230 }]);
    expect(raw[0]).toBe(Math.round((30 / 255) * 32767));
    expect(raw[256]).toBe(Math.round((230 / 255) * 32767));
  });

  it("cleans unsorted, duplicate and out-of-range points", () => {
    expect(cleanPoints([{ x: 300, y: -5 }, { x: 10, y: 10 }, { x: 10, y: 20 }])).toEqual([
      { x: 10, y: 20 },
      { x: 255, y: 0 },
    ]);
  });
});
