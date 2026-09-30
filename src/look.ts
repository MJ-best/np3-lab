import { BLENDER_COLORS, GRADING_RANGES, type RecipeParams } from "./np3/recipe";

/*
 * Reads a recipe's values and names its look ("warm · vivid · matte film"), so every
 * recipe gets a concept even when nobody wrote a description for it.
 */

export interface Look {
  /** Look tags, drawn from the gallery's tag vocabulary. */
  tags: string[];
  summary: { ko: string; en: string };
}

type Phrase = [tag: string | null, ko: string, en: string];

/** Tint of a colour-grading hue: warm (red/orange/yellow) or cool (cyan/blue), with a weight for green/magenta. */
function tintOf(hue: number): { warm: number; cool: number; green: number; magenta: number } {
  const h = ((hue % 360) + 360) % 360;
  if (h < 70 || h >= 335) return { warm: 1, cool: 0, green: 0, magenta: 0 };
  if (h < 145) return { warm: 0, cool: 0, green: 1, magenta: 0 };
  if (h < 265) return { warm: 0, cool: 1, green: 0, magenta: 0 };
  return { warm: 0, cool: 0, green: 0, magenta: 1 };
}

const cache = new WeakMap<RecipeParams, Look>();

/** analyzeLook, memoised per params object (recipes are immutable). */
export function lookOf(p: RecipeParams, monoHint = false): Look {
  let look = cache.get(p);
  if (!look) cache.set(p, (look = analyzeLook(p, monoHint)));
  return look;
}

/*
 * Thresholds are calibrated on the ~270 community recipes: most of them already add
 * contrast (median slider +25, median curve mid-slope 1.25), so only the top and
 * bottom ~15% are called out.
 */
export function analyzeLook(p: RecipeParams, monoHint = false): Look {
  const phrases: Phrase[] = [];
  const sat = p.saturation ?? 0;
  const blender = p.colorBlender ?? {};
  const allColorsGone = BLENDER_COLORS.every((c) => (blender[c]?.chroma ?? 0) <= -90);
  // Some B&W recipes desaturate in ways the values don't show; trust the name then.
  const mono = monoHint || sat <= -95 || allColorsGone;

  // Colour: tint from grading (weighted by chroma, midtones count most).
  const tint = { warm: 0, cool: 0, green: 0, magenta: 0 };
  if (!mono) {
    const weight = { shadows: 0.8, midTone: 1, highlights: 0.8 };
    for (const r of GRADING_RANGES) {
      const g = p.colorGrading?.[r];
      if (!g || (g.chroma ?? 0) <= 0) continue;
      const t = tintOf(g.hue ?? 0);
      const w = (g.chroma ?? 0) * weight[r];
      tint.warm += t.warm * w;
      tint.cool += t.cool * w;
      tint.green += t.green * w;
      tint.magenta += t.magenta * w;
    }
  }
  const TINT_MIN = 12;

  if (mono) phrases.push(["mono", "흑백", "black & white"]);
  else {
    if (tint.warm >= TINT_MIN && tint.cool >= TINT_MIN) phrases.push([null, "웜/쿨 스플릿 톤", "warm/cool split tone"]);
    else if (tint.warm >= TINT_MIN) phrases.push(["warm", "웜톤", "warm"]);
    else if (tint.cool >= TINT_MIN) phrases.push(["cool", "쿨톤", "cool"]);
    if (tint.green >= TINT_MIN) phrases.push([null, "그린 틴트", "green tint"]);
    if (tint.magenta >= TINT_MIN) phrases.push([null, "마젠타 틴트", "magenta tint"]);

    if (sat >= 30) phrases.push(["vivid", "비비드", "vivid"]);
    else if (sat <= -20) phrases.push(["muted", "저채도", "muted"]);

    // A strongly pushed colour in the blender is usually the point of the recipe.
    let boosted: string | null = null;
    let best = 40;
    for (const c of BLENDER_COLORS) {
      const chroma = blender[c]?.chroma ?? 0;
      if (chroma > best) {
        best = chroma;
        boosted = c;
      }
    }
    if (boosted) {
      const names: Record<string, [string, string]> = {
        red: ["레드", "red"],
        orange: ["오렌지", "orange"],
        yellow: ["옐로", "yellow"],
        green: ["그린", "green"],
        cyan: ["시안", "cyan"],
        blue: ["블루", "blue"],
        purple: ["퍼플", "purple"],
        magenta: ["마젠타", "magenta"],
      };
      phrases.push([null, `${names[boosted][0]} 강조`, `${names[boosted][1]} pop`]);
    }
  }

  // Tone.
  const curve = p.toneCurve?.raw;
  if (curve && curve.length === 257) {
    const max = 32767;
    const lift = curve[0] / max;
    const roll = 1 - curve[256] / max;
    const slope = (curve[192] - curve[64]) / (max * 0.5);
    if (lift >= 0.05) phrases.push(["film", "블랙을 띄운 매트 필름 톤", "matte, lifted blacks"]);
    else if (roll >= 0.06) phrases.push(["film", "하이라이트를 누른 필름 톤", "rolled-off highlights"]);
    if (slope >= 1.4) phrases.push(["contrasty", "강한 대비", "punchy contrast"]);
    else if (slope <= 1.05) phrases.push(["soft", "부드러운 대비", "gentle contrast"]);
  } else {
    const contrast = p.contrast ?? 0;
    if (contrast >= 50) phrases.push(["contrasty", "강한 대비", "punchy contrast"]);
    else if (contrast <= -15) phrases.push(["soft", "부드러운 대비", "gentle contrast"]);
    if ((p.blackLevel ?? 0) >= 15 || (p.shadows ?? 0) >= 40) phrases.push(["film", "밝게 띄운 섀도", "lifted shadows"]);
  }
  if ((p.clarity ?? 0) <= -1.5) phrases.push(["soft", "은은한 글로우", "soft glow"]);
  else if ((p.clarity ?? 0) >= 2) phrases.push([null, "선명한 질감", "crisp texture"]);

  if (phrases.length === 0) phrases.push([null, "자연스러운 기본 톤", "natural, close to standard"]);

  return {
    tags: [...new Set(phrases.map(([tag]) => tag).filter((t): t is string => t !== null))],
    summary: {
      ko: phrases.map(([, ko]) => ko).join(" · "),
      en: phrases.map(([, , en]) => en).join(" · "),
    },
  };
}
