import {
  BLENDER_COLORS,
  GRADING_RANGES,
  RANGES,
  SCALAR_KEYS,
  TONE_KEYS,
  defaultParams,
  normalizeParams,
  type BlenderColor,
  type ColorBlenderValues,
  type ColorGradingValues,
  type GradingRange,
  type RecipeParams,
  type ScalarKey,
} from "./recipe";
import { toneCurveFromPoints, type CurvePoint } from "./toneCurve";

/*
 * Plain-text recipe format, compatible with how people share Flexible Color
 * settings on Reddit / forums. The formatter writes a canonical English layout;
 * the parser is lenient and also understands Korean labels and shorthand such
 * as "Red: H+10 S-20 B0" or "Contrast -15, Highlights -30".
 */

const SCALAR_LABELS: Record<ScalarKey, string> = {
  sharpning: "Sharpening",
  midRangeSharpning: "Mid-range sharpening",
  clarity: "Clarity",
  contrast: "Contrast",
  highlights: "Highlights",
  shadows: "Shadows",
  whiteLevel: "White level",
  blackLevel: "Black level",
  saturation: "Saturation",
};

const COLOR_LABELS: Record<BlenderColor, string> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  green: "Green",
  cyan: "Cyan",
  blue: "Blue",
  purple: "Purple",
  magenta: "Magenta",
};

const RANGE_LABELS: Record<GradingRange, string> = {
  highlights: "Highlights",
  midTone: "Mid-tone",
  shadows: "Shadows",
};

const signed = (v: number, decimals = 0) => {
  const s = v.toFixed(decimals);
  return v > 0 ? `+${s}` : s;
};

export function formatRecipeText(npName: string, params: RecipeParams): string {
  const p = normalizeParams(params);
  const lines: string[] = [`Name: ${npName}`, "Picture Control: Flexible Color"];
  const hasCurve = !!p.toneCurve;
  for (const key of SCALAR_KEYS) {
    if (hasCurve && (TONE_KEYS as readonly string[]).includes(key)) continue;
    const decimals = RANGES[key].step < 1 ? 2 : 0;
    lines.push(`${SCALAR_LABELS[key]}: ${signed(p[key] ?? 0, decimals)}`);
  }
  const blender = p.colorBlender ?? {};
  const blenderLines = BLENDER_COLORS.filter((c) => blender[c]).map((c) => {
    const v = blender[c]!;
    return `  ${COLOR_LABELS[c]}: Hue ${signed(v.hue ?? 0)} / Chroma ${signed(v.chroma ?? 0)} / Brightness ${signed(v.brightness ?? 0)}`;
  });
  if (blenderLines.length > 0) lines.push("Color Blender:", ...blenderLines);
  const g = p.colorGrading ?? {};
  const gradingLines = GRADING_RANGES.filter((r) => g[r]).map((r) => {
    const v = g[r]!;
    return `  ${RANGE_LABELS[r]}: Hue ${v.hue ?? 0} / Chroma ${signed(v.chroma ?? 0)} / Brightness ${signed(v.brightness ?? 0)}`;
  });
  if (gradingLines.length > 0 || (g.blending ?? 50) !== 50 || (g.balance ?? 0) !== 0) {
    lines.push("Color Grading:", ...gradingLines, `  Blending: ${g.blending ?? 50}`, `  Balance: ${signed(g.balance ?? 0)}`);
  }
  if (p.toneCurve) {
    lines.push(`Tone Curve: ${p.toneCurve.points.map((pt) => `(${pt.x},${pt.y})`).join(" ")}`);
  }
  if (p.comment) lines.push(`Comment: ${p.comment}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Parser

const NUM = String.raw`([+-]?\d+(?:\.\d+)?)`;
/** Left boundary that works for Latin, Hangul and Japanese (kana/kanji) words. */
const LB = String.raw`(?<![a-z가-힣ぁ-んァ-ヶー一-龯])`;
const SEP = String.raw`\s*[:=：]?\s*`;

const SCALAR_ALIASES: [ScalarKey, string[]][] = [
  // Order matters: longer / more specific phrases first; matches are blanked out.
  ["midRangeSharpning", ["mid[- ]?range sharpening", "mid[- ]?range sharpness", "mid[- ]?range", "미드\\s?레인지\\s?샤프닝", "미드\\s?레인지", "ミドルレンジシャープ(?:ネス)?"]],
  ["sharpning", ["sharpening", "sharpness", "sharpen", "샤프닝", "윤곽\\s?강조", "선명도", "輪郭強調", "シャープネス"]],
  ["clarity", ["clarity", "명료도", "클래리티", "明瞭度"]],
  ["contrast", ["contrast", "콘트라스트", "대비", "コントラスト"]],
  ["whiteLevel", ["white level", "whites?", "화이트\\s?레벨", "화이트", "白レベル", "ホワイトレベル"]],
  ["blackLevel", ["black level", "blacks?", "블랙\\s?레벨", "블랙", "黒レベル", "ブラックレベル"]],
  ["highlights", ["highlights?", "하이라이트", "ハイライト"]],
  ["shadows", ["shadows?", "섀도우?", "쉐도우?", "그림자", "シャド[ーウ]"]],
  ["saturation", ["saturation", "채도", "色の濃さ(?:[（(]彩度[）)])?", "彩度"]],
];

const COLOR_ALIASES: [BlenderColor, string[]][] = [
  ["red", ["reds?", "레드", "빨강", "빨간색", "レッド", "赤"]],
  ["orange", ["oranges?", "오렌지", "주황", "주황색", "オレンジ"]],
  ["yellow", ["yellows?", "옐로우?", "노랑", "노란색", "イエロー", "黄"]],
  ["green", ["greens?", "그린", "초록", "초록색", "녹색", "グリーン", "緑"]],
  ["cyan", ["cyans?", "aqua", "시안", "청록", "シアン"]],
  ["blue", ["blues?", "블루", "파랑", "파란색", "ブルー", "青"]],
  ["purple", ["purples?", "violet", "퍼플", "보라", "보라색", "パープル", "紫"]],
  ["magenta", ["magentas?", "마젠타", "자홍", "マゼンタ"]],
];

const RANGE_ALIASES: [GradingRange, string[]][] = [
  ["highlights", ["highlights?", "하이라이트", "ハイライト"]],
  ["midTone", ["mid[- ]?tones?", "midtones?", "mid(?![- ]?range)", "중간\\s?톤", "미드\\s?톤", "中間調", "ミッドトーン"]],
  ["shadows", ["shadows?", "섀도우?", "쉐도우?", "그림자", "シャド[ーウ]"]],
];

const SUB_ALIASES = {
  hue: ["hue", "h", "색상", "색조", "色相"],
  chroma: ["chroma", "saturation", "sat", "c", "s", "채도", "彩度"],
  brightness: ["brightness", "bright", "luminance", "lum", "b", "l", "밝기", "명도", "明度"],
} as const;

const words = (aliases: readonly string[]) => `(?:${aliases.join("|")})`;

function findNumberAfter(line: string, aliases: readonly string[]): number | undefined {
  const m = new RegExp(`${LB}${words(aliases)}${SEP}${NUM}`).exec(line);
  return m ? Number(m[1]) : undefined;
}

function startsWithAlias(line: string, aliases: readonly string[]): RegExpExecArray | null {
  return new RegExp(`^\\s*[-*•]?\\s*${words(aliases)}(?![a-z])`).exec(line);
}

function parseTriplet(rest: string): { hue?: number; chroma?: number; brightness?: number } {
  const out: { hue?: number; chroma?: number; brightness?: number } = {};
  out.hue = findNumberAfter(rest, SUB_ALIASES.hue);
  out.chroma = findNumberAfter(rest, SUB_ALIASES.chroma);
  out.brightness = findNumberAfter(rest, SUB_ALIASES.brightness);
  if (out.hue === undefined && out.chroma === undefined && out.brightness === undefined) {
    // Positional shorthand: "Red: +10 / -20 / 0"
    const nums = [...rest.matchAll(new RegExp(NUM, "g"))].map((m) => Number(m[1]));
    if (nums.length >= 1) out.hue = nums[0];
    if (nums.length >= 2) out.chroma = nums[1];
    if (nums.length >= 3) out.brightness = nums[2];
  }
  return out;
}

const hasTriplet = (t: { hue?: number; chroma?: number; brightness?: number }) =>
  t.hue !== undefined || t.chroma !== undefined || t.brightness !== undefined;


type Section = "none" | "blender" | "grading";
type Triplet = { hue: number; chroma: number; brightness: number };

/** One value found on a line. `key` identifies the setting so repeats can be detected. */
export type Assignment =
  | { key: ScalarKey; value: number }
  | { key: `blender.${BlenderColor}`; value: Triplet }
  | { key: `grading.${GradingRange}`; value: Triplet }
  | { key: "grading.blending" | "grading.balance"; value: number }
  | { key: "curve"; value: CurvePoint[] }
  | { key: "name" | "comment"; value: string };

interface LineAnalysis {
  assignments: Assignment[];
  section: Section;
  /** "header" = a section heading such as "Color Blender:" with nothing else on the line. */
  kind: "values" | "header" | "ignored" | "unrecognized";
}

const BLENDER_HEADER = /color\s*blender|컬러\s*블렌더|블렌더|カラーブレンダー/;
const GRADING_HEADER = /colou?r\s*grading|컬러\s*그레이딩|그레이딩|カラーグレーディング/;
/** Headings people put between groups of values; they belong to the same recipe. */
const NEUTRAL_HEADER =
  /^(?:tone|tones|detail|details|color|colour|basic|settings?|adjustments?|advanced|톤|디테일|컬러|색상|기본|설정|トーン|詳細(?:調整)?|カラー|基本|設定)\s*[:：]?$/;

/** Undo Markdown/Reddit formatting that would hide "Key: value" pairs. */
function normalizeLine(line: string): string {
  return line
    .replace(/[−–—]/g, "-")
    .replace(/＋/g, "+")
    .replace(/：/g, ":")
    .replace(/[*`|]/g, " ")
    .replace(/^\s*(?:>+|#+)\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toTriplet(t: { hue?: number; chroma?: number; brightness?: number }): Triplet {
  return { hue: t.hue ?? 0, chroma: t.chroma ?? 0, brightness: t.brightness ?? 0 };
}

/** Classify a single (non-empty) line given the section it appears in. Pure: no state. */
export function analyzeLine(rawLine: string, section: Section): LineAnalysis {
  const original = normalizeLine(rawLine);
  const assignments: Assignment[] = [];
  if (!original) return { assignments, section, kind: "ignored" };
  let line = original.toLowerCase();

  const nameMatch = /^(?:(?:name|이름|recipe name|레시피 이름|名前|レシピ名)\s*[:=：]|\[nikonpc lab\])\s*(.+)$/i.exec(original);
  if (nameMatch) return { assignments: [{ key: "name", value: nameMatch[1].trim() }], section, kind: "values" };
  const commentMatch = /^(?:comment|memo|메모|코멘트|メモ|コメント)\s*[:=：]\s*(.+)$/i.exec(original);
  if (commentMatch) return { assignments: [{ key: "comment", value: commentMatch[1].trim() }], section, kind: "values" };
  if (/^(?:picture control|base|베이스|픽처\s?컨트롤)\s*[:=]/.test(line)) return { assignments, section, kind: "ignored" };
  if (NEUTRAL_HEADER.test(line)) return { assignments, section: "none", kind: "header" };

  if (/tone\s*curve|톤\s*커브|トーンカーブ/.test(line)) {
    const pts = [...line.matchAll(/(\d{1,3})\s*[,/]\s*(\d{1,3})/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    if (pts.length >= 2) return { assignments: [{ key: "curve", value: pts }], section: "none", kind: "values" };
    return { assignments, section: "none", kind: "unrecognized" };
  }

  if (BLENDER_HEADER.test(line)) {
    section = "blender";
    line = line.replace(BLENDER_HEADER, "").replace(/^\s*[:=]/, "");
    if (!line.trim()) return { assignments, section, kind: "header" };
  } else if (GRADING_HEADER.test(line)) {
    section = "grading";
    line = line.replace(GRADING_HEADER, "").replace(/^\s*[:=]/, "");
    if (!line.trim()) return { assignments, section, kind: "header" };
  }

  // Colour blender entry: "Red: Hue +5 / Chroma -10 / Brightness 0"
  const colorHit = COLOR_ALIASES.map(([c, al]) => [c, startsWithAlias(line, al)] as const).find(([, m]) => m);
  if (colorHit) {
    const [color, m] = colorHit;
    const t = parseTriplet(line.slice(m!.index + m![0].length));
    if (hasTriplet(t)) return { assignments: [{ key: `blender.${color}`, value: toTriplet(t) }], section, kind: "values" };
  }

  // Colour grading entry: in the grading section, or any range line that mentions a hue.
  const rangeHit = RANGE_ALIASES.map(([r, al]) => [r, startsWithAlias(line, al)] as const).find(([, m]) => m);
  const mentionsHue = new RegExp(`${LB}${words(SUB_ALIASES.hue)}${SEP}${NUM}`).test(line) && /hue|색상|색조/.test(line);
  if (rangeHit && (section === "grading" || mentionsHue)) {
    const [range, m] = rangeHit;
    const t = parseTriplet(line.slice(m!.index + m![0].length));
    if (hasTriplet(t)) return { assignments: [{ key: `grading.${range}`, value: toTriplet(t) }], section, kind: "values" };
  }

  const take = (aliases: readonly string[]): number | undefined => {
    const m = new RegExp(`${LB}${words(aliases)}${SEP}${NUM}`).exec(line);
    if (!m) return undefined;
    line = line.slice(0, m.index) + " ".repeat(m[0].length) + line.slice(m.index + m[0].length);
    return Number(m[1]);
  };
  const blending = take(["blending", "blend", "블렌딩", "ブレンド"]);
  if (blending !== undefined) assignments.push({ key: "grading.blending", value: blending });
  const balance = take(["balance", "밸런스", "バランス"]);
  if (balance !== undefined) assignments.push({ key: "grading.balance", value: balance });

  // Scalar values, possibly several per line ("Contrast -15, Highlights -30").
  for (const [key, aliases] of SCALAR_ALIASES) {
    const v = take(aliases);
    if (v === undefined) continue;
    assignments.push({ key, value: v });
    if (!colorHit && !rangeHit) section = "none";
  }

  return { assignments, section, kind: assignments.length > 0 ? "values" : "unrecognized" };
}

/** Collects assignments into recipe parameters; later values win. */
class RecipeAccumulator {
  readonly keys = new Set<string>();
  readonly unrecognized: string[] = [];
  private params = defaultParams();
  private blender: Partial<Record<BlenderColor, ColorBlenderValues>> = {};
  private grading: Partial<Record<GradingRange, ColorGradingValues>> & { blending?: number; balance?: number } = {
    blending: 50,
    balance: 0,
  };
  private curve: CurvePoint[] | undefined;
  name: string | undefined;
  recognized = 0;

  /** Number of actual picture-control values (name/comment excluded). */
  get valueCount(): number {
    return [...this.keys].filter((k) => k !== "name" && k !== "comment").length;
  }

  add(a: Assignment) {
    this.keys.add(a.key);
    this.recognized++;
    if (a.key === "name") this.name = a.value as string;
    else if (a.key === "comment") this.params.comment = a.value as string;
    else if (a.key === "curve") this.curve = a.value as CurvePoint[];
    else if (a.key === "grading.blending") this.grading.blending = a.value as number;
    else if (a.key === "grading.balance") this.grading.balance = a.value as number;
    else if (a.key.startsWith("blender.")) this.blender[a.key.slice(8) as BlenderColor] = a.value as Triplet;
    else if (a.key.startsWith("grading.")) this.grading[a.key.slice(8) as GradingRange] = a.value as Triplet;
    else this.params[a.key as ScalarKey] = a.value as number;
  }

  result(): ParseResult {
    const params: RecipeParams = { ...this.params, colorBlender: this.blender, colorGrading: this.grading };
    if (this.curve) params.toneCurve = toneCurveFromPoints(this.curve);
    return { params: normalizeParams(params), name: this.name, recognized: this.recognized, unrecognized: this.unrecognized };
  }
}

export interface ParseResult {
  params: RecipeParams;
  name?: string;
  /** Number of individual values recognised. */
  recognized: number;
  /** Non-empty lines that yielded nothing. */
  unrecognized: string[];
}

const splitLines = (input: string) => input.replace(/\r/g, "").split("\n");

/** Parse text that describes a single recipe. */
export function parseRecipeText(input: string): ParseResult {
  const acc = new RecipeAccumulator();
  let section: Section = "none";
  for (const raw of splitLines(input)) {
    if (!raw.trim()) continue;
    const a = analyzeLine(raw, section);
    section = a.section;
    for (const x of a.assignments) acc.add(x);
    if (a.kind === "unrecognized") acc.unrecognized.push(raw.trim());
  }
  return acc.result();
}

// ---------------------------------------------------------------------------
// Multi-recipe text (a Reddit post with comments, a forum thread, a notes file)

export interface ParsedBlock extends ParseResult {
  /** Best guess at the recipe's title (heading line or Name:). */
  title?: string;
  /** Reddit username (without "u/") found closest before the recipe. */
  author?: string;
}

/** Lines copied along with a Reddit page that are never recipe titles. */
const NOISE =
  /^(?:reply|share|save|saved|report|follow|join|joined|upvote|downvote|vote|award|awards|edited|more replies|continue this thread|sort by:?.*|best|top|new|hot|controversial|old|q&a|open comment sort options|view all comments|single comment thread|see full discussion|level \d+|op|mod|promoted|comments?|\d+ comments?|[\d.,]+k?|go to comments|•.*|·.*|\d+\s*(?:s|m|h|d|w|mo|y|yr|yrs|min|mins|hr|hrs|hour|hours|day|days|week|weeks|month|months|year|years)\.?\s*ago|posted by.*|r\/\S+|u\/\S+|archived post.*|this thread is archived.*|add a comment|comment|user avatar|profile badge.*|top \d+% commenter|reddit|home|popular|explore)$/i;

function titleCandidate(raw: string): string | undefined {
  const line = normalizeLine(raw)
    .replace(/^(?:\d+[.)]|[-•])\s+/, "")
    .replace(/[:：]\s*$/, "")
    .trim();
  if (line.length < 3 || line.length > 60) return undefined;
  if (NOISE.test(line) || NEUTRAL_HEADER.test(line.toLowerCase())) return undefined;
  if (/^https?:\/\//i.test(line) || /[?]$/.test(line)) return undefined;
  if (line.split(/\s+/).length > 9) return undefined;
  return line;
}

/**
 * Split pasted text into separate recipes. A new recipe starts when
 *  - a "Name:" line appears after values,
 *  - a setting repeats (the second "Contrast" belongs to the next recipe), or
 *  - after a blank line, a short title-like line is followed by more values.
 * Blocks with fewer than `minValues` values are dropped as incidental mentions.
 */
export function parseRecipes(input: string, minValues = 2): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let acc = new RecipeAccumulator();
  let title: string | undefined;
  let author: string | undefined;
  let pendingTitle: string | undefined;
  let lastAuthor: string | undefined;
  let gapSinceValues = false;
  let section: Section = "none";

  const flush = () => {
    if (acc.valueCount >= minValues) {
      const r = acc.result();
      blocks.push({ ...r, title: r.name ?? title, author });
    }
  };

  for (const raw of splitLines(input)) {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (acc.valueCount > 0) gapSinceValues = true;
      continue;
    }
    const user = /(?:^|\s)u\/([A-Za-z0-9_-]{3,20})\b/.exec(trimmed);
    if (user) lastAuthor = user[1];

    const a = analyzeLine(trimmed, section);
    if (a.kind === "values") {
      const keys = a.assignments.map((x) => x.key);
      const repeats = keys.some((k) => acc.keys.has(k));
      const startsByName = keys.includes("name") && acc.valueCount > 0;
      const startsByTitle = gapSinceValues && pendingTitle !== undefined && acc.valueCount >= 3;
      if (acc.valueCount > 0 && (repeats || startsByName || startsByTitle)) {
        flush();
        acc = new RecipeAccumulator();
        title = pendingTitle;
        author = lastAuthor;
      } else if (acc.valueCount === 0 && acc.recognized === 0) {
        title = pendingTitle;
        author = lastAuthor;
      }
      for (const x of a.assignments) acc.add(x);
      pendingTitle = undefined;
      gapSinceValues = false;
    } else if (a.kind === "unrecognized") {
      const t = titleCandidate(trimmed);
      if (t) pendingTitle = t;
      acc.unrecognized.push(trimmed);
    }
    section = a.section;
  }
  flush();
  return blocks;
}

export interface SourceMeta {
  url?: string;
  author?: string;
  kind: "reddit" | "community" | "text";
}

/** Find a source link and author in pasted text (Reddit post URL, "u/name"). */
export function extractSourceMeta(input: string): SourceMeta {
  const reddit = /https?:\/\/(?:(?:www|old|new|np)\.)?reddit\.com\/r\/[^\s)>\]]+|https?:\/\/redd\.it\/[^\s)>\]]+/i.exec(input);
  const any = /https?:\/\/[^\s)>\]]+/i.exec(input);
  const author = /(?:^|\s)u\/([A-Za-z0-9_-]{3,20})\b/.exec(input)?.[1];
  if (reddit) return { url: reddit[0], author, kind: "reddit" };
  if (any) return { url: any[0], author, kind: "community" };
  return { author, kind: author ? "reddit" : "text" };
}
