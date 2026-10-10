import {
  BLENDER_COLORS,
  TONE_KEYS,
  normalizeParams,
  type BlenderColor,
  type ColorBlenderValues,
  type GradingRange,
  type LocalizedText,
  type RecipeParams,
  type ScalarKey,
} from "./np3/recipe";

/*
 * One-tap looks for the editor: a mood (clear, film, positive film…), a skin tone (warm, cool,
 * pink…) and a colour to bring out. Each is a set of changes added on top of the recipe being
 * edited, so they combine and can be taken back. They only use what the NP3 format stores: tone
 * and colour sliders, the colour blender and colour grading (no grain, vignette or white balance).
 *
 * In the colour blender, skin sits between the red and orange bands (about 70% orange), so skin
 * looks move both. A positive blender hue moves a colour towards the next band (orange → yellow).
 */

export type MoodGroup = "look" | "skin" | "accent";
export const MOOD_GROUPS: MoodGroup[] = ["look", "skin", "accent"];

export interface MoodDelta {
  /** Added to the sliders. Tone ones (contrast … black level) are skipped while a tone curve is used. */
  scalars?: Partial<Record<ScalarKey, number>>;
  /** Added to each blender band. */
  blender?: Partial<Record<BlenderColor, Partial<ColorBlenderValues>>>;
  /** A tint added to each grading range (as a colour, so it mixes with a tint already there). */
  grading?: Partial<Record<GradingRange, { hue: number; chroma: number; brightness?: number }>>;
}

export interface Mood {
  id: string;
  group: MoodGroup;
  label: LocalizedText;
  hint: LocalizedText;
  /** Swatch on the chip (CSS colour); none for moods. */
  dot?: string;
  delta: MoodDelta;
}

export type MoodPicks = Partial<Record<MoodGroup, string>>;

export type MoodStrength = "soft" | "normal" | "strong";
export const MOOD_STRENGTHS: MoodStrength[] = ["soft", "normal", "strong"];
export const STRENGTH_SCALE: Record<MoodStrength, number> = { soft: 0.6, normal: 1, strong: 1.5 };

const LOOKS: Mood[] = [
  {
    id: "clear",
    group: "look",
    label: { ko: "맑고 투명하게", en: "Clear & crisp", ja: "クリアで透明" },
    hint: {
      ko: "깨끗한 흰색, 맑은 하늘, 또렷한 디테일. 소니 카메라처럼 투명한 디지털 느낌.",
      en: "Clean whites, clear skies, crisp detail: a transparent digital look, like a Sony camera.",
      ja: "白はクリーンに、空は澄んで、ディテールはくっきり。ソニーのカメラのような透明感。",
    },
    delta: {
      scalars: { contrast: 12, highlights: -20, shadows: 20, whiteLevel: 8, blackLevel: -6, saturation: 10, clarity: 1.25 },
      blender: { blue: { chroma: 20, brightness: -6 }, cyan: { chroma: 15 }, green: { chroma: -10 }, orange: { brightness: 8 } },
      grading: { highlights: { hue: 205, chroma: 8 }, midTone: { hue: 215, chroma: 6 } },
    },
  },
  {
    id: "film",
    group: "look",
    label: { ko: "감성 필름", en: "Soft film", ja: "エモいフィルム" },
    hint: {
      ko: "부드러운 대비, 차분한 초록, 청록빛 그림자와 따뜻한 하이라이트. 후지필름처럼 감성적인 색.",
      en: "Gentle contrast, quiet greens, teal shadows and warm highlights: the mood of Fujifilm colour.",
      ja: "やわらかなコントラスト、落ち着いた緑、青緑の影と暖かいハイライト。富士フイルムのようなエモい色。",
    },
    delta: {
      scalars: { contrast: -15, highlights: -25, shadows: 12, blackLevel: 10, saturation: -15, clarity: -0.75 },
      blender: {
        green: { hue: 30, chroma: -30 },
        yellow: { hue: -15, chroma: -20 },
        blue: { hue: -18, chroma: -12 },
        red: { chroma: 10, brightness: -6 },
        orange: { brightness: 6 },
      },
      grading: { shadows: { hue: 185, chroma: 18 }, highlights: { hue: 40, chroma: 14 } },
    },
  },
  {
    id: "positive",
    group: "look",
    label: { ko: "포지티브 필름", en: "Positive film", ja: "ポジフィルム" },
    hint: {
      ko: "진한 색, 단단한 대비, 노랗게 물든 하이라이트. 리코 GR처럼 필름 같은 느낌.",
      en: "Rich colour, firm contrast and golden highlights: slide film, like a Ricoh GR.",
      ja: "濃い色、しっかりしたコントラスト、黄色く色づくハイライト。リコーGRのようなフィルムらしさ。",
    },
    delta: {
      scalars: { contrast: 25, highlights: -10, shadows: -10, saturation: 18, clarity: 0.5 },
      blender: {
        red: { chroma: 18 },
        orange: { hue: -8, chroma: 10 },
        yellow: { chroma: 18 },
        green: { hue: -18, chroma: 10 },
        cyan: { hue: 10 },
        blue: { chroma: 18, brightness: -10 },
      },
      grading: { highlights: { hue: 48, chroma: 20 }, midTone: { hue: 40, chroma: 6 }, shadows: { hue: 165, chroma: 10 } },
    },
  },
  {
    id: "vintage",
    group: "look",
    label: { ko: "빈티지", en: "Vintage", ja: "ヴィンテージ" },
    hint: {
      ko: "검정을 띄우고 색을 바랜, 오래된 앨범 속 사진 같은 느낌.",
      en: "Lifted blacks and faded colour, like a print from an old album.",
      ja: "黒を浮かせて色をあせさせた、古いアルバムの写真のような雰囲気。",
    },
    delta: {
      scalars: { contrast: -20, blackLevel: 25, whiteLevel: -12, highlights: -12, saturation: -32, clarity: -1 },
      blender: { green: { hue: 12, chroma: -18 }, blue: { chroma: -18 } },
      grading: { highlights: { hue: 42, chroma: 20 }, midTone: { hue: 40, chroma: 8 }, shadows: { hue: 25, chroma: 10 } },
    },
  },
  {
    id: "cinematic",
    group: "look",
    label: { ko: "시네마틱", en: "Cinematic", ja: "シネマティック" },
    hint: {
      ko: "청록빛 그림자와 주황빛 하이라이트. 영화 장면 같은 색 대비.",
      en: "Teal shadows and orange highlights, the colour contrast of a film still.",
      ja: "青緑の影とオレンジのハイライト。映画のワンシーンのような色の対比。",
    },
    delta: {
      scalars: { contrast: 15, highlights: -15, shadows: 6, saturation: -10 },
      blender: { orange: { chroma: 12 }, blue: { hue: -25, chroma: 6 }, green: { hue: 25, chroma: -18 }, cyan: { chroma: 12 } },
      grading: { shadows: { hue: 190, chroma: 26 }, highlights: { hue: 32, chroma: 20 } },
    },
  },
  {
    id: "dreamy",
    group: "look",
    label: { ko: "몽환적인", en: "Dreamy", ja: "幻想的" },
    hint: {
      ko: "부드럽게 번지는 빛과 연한 분홍빛. 화사하고 몽환적인 인물 사진.",
      en: "Soft, glowing light with a hint of pink, for airy portraits.",
      ja: "やわらかくにじむ光と淡いピンク。ふんわり幻想的なポートレートに。",
    },
    delta: {
      scalars: { contrast: -18, highlights: 10, whiteLevel: 10, shadows: 12, saturation: -12, clarity: -2.5 },
      grading: { highlights: { hue: 330, chroma: 14 }, shadows: { hue: 260, chroma: 10 } },
    },
  },
  {
    id: "mono",
    group: "look",
    label: { ko: "진한 흑백", en: "Rich B&W", ja: "濃いモノクロ" },
    hint: {
      ko: "색을 빼고 대비를 올린 묵직한 흑백.",
      en: "No colour, more contrast: a weighty black and white.",
      ja: "色を抜いてコントラストを上げた、重厚なモノクロ。",
    },
    delta: { scalars: { saturation: -100, contrast: 25, clarity: 1, blackLevel: -6 } },
  },
];

const SKIN: Mood[] = [
  {
    id: "warm",
    group: "skin",
    label: { ko: "웜톤", en: "Warm", ja: "イエベ" },
    hint: {
      ko: "노란 기가 도는 피부를 따뜻하고 건강하게. 웜톤 피부에 어울려요.",
      en: "Golden, healthy skin; flattering for warm undertones.",
      ja: "黄みのある肌を暖かく健康的に。イエベ肌に似合います。",
    },
    dot: "#e6b07a",
    delta: {
      blender: { orange: { hue: 18, chroma: 10, brightness: 4 }, red: { hue: 10, chroma: 4 } },
      grading: { midTone: { hue: 38, chroma: 8 }, highlights: { hue: 45, chroma: 8 } },
    },
  },
  {
    id: "cool",
    group: "skin",
    label: { ko: "쿨톤", en: "Cool", ja: "ブルベ" },
    hint: {
      ko: "노란 기를 덜어 맑고 깨끗한 피부로. 쿨톤 피부에 어울려요.",
      en: "Less yellow, clearer skin; flattering for cool undertones.",
      ja: "黄みを抑えて透明感のある肌に。ブルベ肌に似合います。",
    },
    dot: "#e9c3b8",
    delta: {
      blender: { orange: { hue: -18, chroma: -10, brightness: 8 }, red: { hue: -8 }, yellow: { chroma: -12 } },
      grading: { midTone: { hue: 215, chroma: 6 }, highlights: { hue: 205, chroma: 6 } },
    },
  },
  {
    id: "pink",
    group: "skin",
    label: { ko: "핑크톤", en: "Pink", ja: "ピンク" },
    hint: {
      ko: "볼에 혈색이 도는 사랑스러운 핑크빛 피부.",
      en: "Rosy cheeks and a soft pink glow.",
      ja: "頬に血色がさす、かわいらしいピンクの肌。",
    },
    dot: "#efb3b5",
    delta: {
      blender: { orange: { hue: -30, chroma: 6, brightness: 6 }, red: { hue: -18, chroma: 10 }, magenta: { chroma: 10 } },
      grading: { midTone: { hue: 350, chroma: 10 }, highlights: { hue: 340, chroma: 6 } },
    },
  },
  {
    id: "fair",
    group: "skin",
    label: { ko: "뽀얀 피부", en: "Fair & smooth", ja: "色白" },
    hint: {
      ko: "밝고 매끈한 피부. 노란 기와 잡티를 부드럽게 덜어 냅니다.",
      en: "Brighter, smoother skin with less yellow and softer blemishes.",
      ja: "明るくなめらかな肌に。黄みや肌のあらをやわらげます。",
    },
    dot: "#f7e1d6",
    delta: {
      scalars: { clarity: -1, highlights: 8, shadows: 8 },
      blender: { orange: { brightness: 25, chroma: -15 }, red: { brightness: 10, chroma: -6 }, yellow: { chroma: -10 } },
    },
  },
  {
    id: "healthy",
    group: "skin",
    label: { ko: "생기 있게", en: "Healthy glow", ja: "血色感" },
    hint: {
      ko: "혈색을 살려 생기 있고 건강해 보이는 피부.",
      en: "More colour in the skin for a lively, healthy look.",
      ja: "血色を生かして、いきいきと健康的な肌に。",
    },
    dot: "#d9926d",
    delta: { blender: { orange: { chroma: 15, brightness: 4 }, red: { chroma: 10, hue: -6 } } },
  },
];

/** Display colour and name for each blender band (chip swatches and labels). */
const ACCENT_NAMES: Record<BlenderColor, [string, LocalizedText]> = {
  red: ["hsl(0 80% 52%)", { ko: "빨강", en: "Red", ja: "赤" }],
  orange: ["hsl(30 85% 52%)", { ko: "노을 · 주황", en: "Orange", ja: "オレンジ" }],
  yellow: ["hsl(52 90% 52%)", { ko: "노랑", en: "Yellow", ja: "黄" }],
  green: ["hsl(120 55% 42%)", { ko: "초록", en: "Green", ja: "緑" }],
  cyan: ["hsl(185 70% 45%)", { ko: "하늘 · 청록", en: "Sky & teal", ja: "空・青緑" }],
  blue: ["hsl(225 75% 55%)", { ko: "파랑", en: "Blue", ja: "青" }],
  purple: ["hsl(270 60% 58%)", { ko: "보라", en: "Purple", ja: "紫" }],
  magenta: ["hsl(320 70% 58%)", { ko: "분홍", en: "Pink", ja: "ピンク" }],
};

/** One colour stronger (and its neighbours a little), the others a little quieter. */
function accent(color: BlenderColor): Mood {
  const i = BLENDER_COLORS.indexOf(color);
  const n = BLENDER_COLORS.length;
  const near = new Set([BLENDER_COLORS[(i + 1) % n], BLENDER_COLORS[(i + n - 1) % n]]);
  const blender: MoodDelta["blender"] = {};
  for (const c of BLENDER_COLORS) blender[c] = { chroma: c === color ? 30 : near.has(c) ? 10 : -15 };
  const [dot, label] = ACCENT_NAMES[color];
  return {
    id: color,
    group: "accent",
    label,
    hint: {
      ko: "고른 색은 진하게, 다른 색은 조금 차분하게.",
      en: "This colour stronger, the others a little quieter.",
      ja: "選んだ色は濃く、ほかの色は少し控えめに。",
    },
    dot,
    delta: { blender },
  };
}

export const MOODS: Mood[] = [...LOOKS, ...SKIN, ...BLENDER_COLORS.map(accent)];

export const moodById = (group: MoodGroup, id: string | undefined) => MOODS.find((m) => m.group === group && m.id === id);

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * The recipe with the picked moods added, `scale` times as strong (see STRENGTH_SCALE).
 * Always computed from `base`, so switching between moods never piles them up.
 * `toneSliders` false (a tone curve is in use) leaves the tone sliders out.
 */
export function applyMoods(base: RecipeParams, picks: MoodPicks, scale: number, toneSliders = true): RecipeParams {
  const out: RecipeParams = {
    ...base,
    colorBlender: { ...base.colorBlender },
    colorGrading: { ...base.colorGrading },
  };
  for (const group of MOOD_GROUPS) {
    const mood = moodById(group, picks[group]);
    if (!mood) continue;
    const d = mood.delta;
    for (const [key, v] of Object.entries(d.scalars ?? {}) as [ScalarKey, number][]) {
      if (!toneSliders && (TONE_KEYS as readonly string[]).includes(key)) continue;
      out[key] = (out[key] ?? 0) + v * scale;
    }
    for (const [color, v] of Object.entries(d.blender ?? {}) as [BlenderColor, Partial<ColorBlenderValues>][]) {
      const cur = out.colorBlender![color] ?? {};
      out.colorBlender![color] = {
        hue: (cur.hue ?? 0) + (v.hue ?? 0) * scale,
        chroma: (cur.chroma ?? 0) + (v.chroma ?? 0) * scale,
        brightness: (cur.brightness ?? 0) + (v.brightness ?? 0) * scale,
      };
    }
    for (const [range, v] of Object.entries(d.grading ?? {}) as [GradingRange, { hue: number; chroma: number; brightness?: number }][]) {
      const cur = out.colorGrading![range] ?? { hue: 0, chroma: 0, brightness: 0 };
      // Tints add as colours: warm on top of warm gets warmer, warm on top of cool cancels out.
      const x = (cur.chroma ?? 0) * Math.cos(rad(cur.hue ?? 0)) + v.chroma * scale * Math.cos(rad(v.hue));
      const y = (cur.chroma ?? 0) * Math.sin(rad(cur.hue ?? 0)) + v.chroma * scale * Math.sin(rad(v.hue));
      const chroma = Math.hypot(x, y);
      out.colorGrading![range] = {
        // No tint left: hue 0 too, so an empty range drops out of the recipe.
        hue: chroma < 0.5 ? 0 : (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360,
        chroma: chroma < 0.5 ? 0 : chroma,
        brightness: (cur.brightness ?? 0) + (v.brightness ?? 0) * scale,
      };
    }
  }
  return normalizeParams(out);
}

