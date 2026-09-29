import { describe, expect, it } from "vitest";
import { normalizeParams } from "../src/np3/recipe";
import { formatRecipeText, parseRecipeText } from "../src/np3/textFormat";
import { toneCurveFromPoints } from "../src/np3/toneCurve";

describe("text recipes", () => {
  it("round-trips the canonical format", () => {
    const params = normalizeParams({
      sharpning: 3,
      midRangeSharpning: 1.5,
      clarity: -1,
      contrast: 15,
      highlights: -40,
      shadows: 22,
      whiteLevel: -5,
      blackLevel: 12,
      saturation: -20,
      colorBlender: { orange: { hue: 8, chroma: -15, brightness: 10 }, green: { hue: -20, chroma: -30, brightness: 0 } },
      colorGrading: { shadows: { hue: 200, chroma: 15, brightness: -5 }, midTone: { hue: 30, chroma: 5, brightness: 0 }, blending: 70, balance: 20 },
      comment: "hello",
    });
    const parsed = parseRecipeText(formatRecipeText("ROUND_TRIP", params));
    expect(parsed.name).toBe("ROUND_TRIP");
    expect(parsed.params).toEqual(params);
    expect(parsed.unrecognized).toEqual([]);
  });

  it("round-trips a tone curve", () => {
    const params = normalizeParams({ toneCurve: toneCurveFromPoints([{ x: 0, y: 25 }, { x: 120, y: 110 }, { x: 255, y: 245 }]) });
    const parsed = parseRecipeText(formatRecipeText("CURVE", params));
    expect(parsed.params.toneCurve?.points).toEqual(params.toneCurve?.points);
  });

  it("understands forum shorthand", () => {
    const text = `Contrast -15, Highlights -30, Shadows +20
Saturation: -10
Clarity +1.5
Color blender
Red: H+10 S-20 B0
Blue: +5 / -10 / 3
Color grading:
Shadows: Hue 210, Chroma 12, Brightness 0
Blending 60`;
    const { params, unrecognized } = parseRecipeText(text);
    expect(params.contrast).toBe(-15);
    expect(params.highlights).toBe(-30);
    expect(params.shadows).toBe(20);
    expect(params.saturation).toBe(-10);
    expect(params.clarity).toBe(1.5);
    expect(params.colorBlender?.red).toEqual({ hue: 10, chroma: -20, brightness: 0 });
    expect(params.colorBlender?.blue).toEqual({ hue: 5, chroma: -10, brightness: 3 });
    expect(params.colorGrading?.shadows).toEqual({ hue: 210, chroma: 12, brightness: 0 });
    expect(params.colorGrading?.blending).toBe(60);
    expect(unrecognized).toEqual([]);
  });

  it("understands Korean labels", () => {
    const text = `이름: KOREAN_TEST
콘트라스트: +10
하이라이트: -20
섀도: +5
채도: -15
명료도: +1
미드레인지 샤프닝: +0.5
컬러 블렌더
빨강: 색상 +5 채도 -10 밝기 +2`;
    const { params, name } = parseRecipeText(text);
    expect(name).toBe("KOREAN_TEST");
    expect(params.contrast).toBe(10);
    expect(params.highlights).toBe(-20);
    expect(params.shadows).toBe(5);
    expect(params.saturation).toBe(-15);
    expect(params.clarity).toBe(1);
    expect(params.midRangeSharpning).toBe(0.5);
    expect(params.colorBlender?.red).toEqual({ hue: 5, chroma: -10, brightness: 2 });
  });

  it("reports lines it could not use", () => {
    const { unrecognized } = parseRecipeText("Contrast +5\nshot on a sunny day");
    expect(unrecognized).toEqual(["shot on a sunny day"]);
  });
});
