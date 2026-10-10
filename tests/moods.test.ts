import { describe, expect, it } from "vitest";
import { MOODS, STRENGTH_SCALE, applyMoods, moodById } from "../src/moods";
import { defaultParams, normalizeParams, paramsToBytes, type RecipeParams } from "../src/np3/recipe";

const delta = (group: "look" | "skin", id: string) => moodById(group, id)!.delta;

const base = (): RecipeParams =>
  normalizeParams({
    ...defaultParams(),
    contrast: 20,
    colorBlender: { orange: { hue: 5, chroma: 0, brightness: 0 } },
    colorGrading: { blending: 50, balance: 0, midTone: { hue: 30, chroma: 10, brightness: 0 } },
  });

describe("applyMoods", () => {
  it("leaves the recipe as it is with nothing picked", () => {
    expect(applyMoods(base(), {}, 1)).toEqual(base());
  });

  it("adds on top of the recipe and starts from it every time, so looks never pile up", () => {
    const warm = applyMoods(base(), { skin: "warm" }, 1);
    expect(warm.colorBlender?.orange?.hue).toBe(5 + delta("skin", "warm").blender!.orange!.hue!);
    // Switching to cool from the same base: no trace of warm.
    const cool = applyMoods(base(), { skin: "cool" }, 1);
    expect(cool.colorBlender?.orange?.hue).toBe(5 + delta("skin", "cool").blender!.orange!.hue!);
    expect(applyMoods(base(), { look: "clear" }, 1).contrast).toBe(20 + delta("look", "clear").scalars!.contrast!);
  });

  it("scales with strength", () => {
    const soft = applyMoods(base(), { look: "film" }, STRENGTH_SCALE.soft);
    const strong = applyMoods(base(), { look: "film" }, STRENGTH_SCALE.strong);
    expect(soft.contrast).toBeGreaterThan(strong.contrast!);
    expect(strong.contrast).toBe(Math.round(20 + delta("look", "film").scalars!.contrast! * STRENGTH_SCALE.strong));
  });

  it("mixes grading tints as colours: an opposite tint cancels out", () => {
    const p = normalizeParams({
      ...defaultParams(),
      colorGrading: { blending: 50, balance: 0, midTone: { hue: 215 + 180, chroma: 6, brightness: 0 } },
    });
    expect(applyMoods(p, { skin: "cool" }, 1).colorGrading?.midTone).toBeUndefined();
  });

  it("leaves tone sliders alone while a tone curve is in use", () => {
    const p = applyMoods(base(), { look: "clear" }, 1, false);
    expect(p.contrast).toBe(20);
    expect(p.saturation).toBe(delta("look", "clear").scalars!.saturation);
  });

  it("gives valid NP3 values for every look at every strength", () => {
    for (const m of MOODS)
      for (const scale of Object.values(STRENGTH_SCALE)) {
        const p = applyMoods(base(), { [m.group]: m.id }, scale);
        expect(normalizeParams(p)).toEqual(p);
        expect(() => paramsToBytes("TEST", p)).not.toThrow();
      }
  });
});
