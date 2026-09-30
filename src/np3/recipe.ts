import {
  deserialize,
  serialize,
  type ColorBlender,
  type ColorBlenderValues,
  type ColorGrading,
  type ColorGradingValues,
  type FlexibleColorPictureControlOptions,
  type ToneCurve,
} from "nikon-flexible-color-picture-control";

export type { ColorBlender, ColorBlenderValues, ColorGrading, ColorGradingValues, ToneCurve };

/** Everything the NP3 file stores except its embedded name. */
export type RecipeParams = Omit<FlexibleColorPictureControlOptions, "name">;

export type LocalizedText = string | { ko?: string; en?: string };

export type RecipeSource = "builtin" | "mine" | "imported";

/** Where a recipe came from, for credit and filtering. */
export interface RecipeOrigin {
  kind: "reddit" | "imaging-cloud" | "community" | "text" | "file" | "card";
  url?: string;
  author?: string;
}

export interface Recipe {
  id: string;
  source: RecipeSource;
  title: LocalizedText;
  /** Name stored inside the NP3 file and shown on the camera (ASCII, max 19). */
  npName: string;
  description?: LocalizedText;
  /** Scenes the recipe suits ("portraits · street"), from the creator's listing. */
  use?: LocalizedText;
  /** Release date (YYYY-MM-DD) from the creator's listing. */
  released?: string;
  /** Where the description comes from, when it isn't the recipe's own author. */
  noteCredit?: string;
  tags: string[];
  author?: string;
  /** Parsed parameters; null when the file could not be understood (still packable via `raw`). */
  params: RecipeParams | null;
  /** Original bytes of an imported NP3. Packaged as-is so nothing is lost in re-encoding. */
  raw?: Uint8Array;
  origin?: RecipeOrigin;
  createdAt?: number;
}

export const BLENDER_COLORS = ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "magenta"] as const;
export type BlenderColor = (typeof BLENDER_COLORS)[number];

export const GRADING_RANGES = ["shadows", "midTone", "highlights"] as const;
export type GradingRange = (typeof GRADING_RANGES)[number];

/** Parameter ranges and step sizes enforced by the NP3 encoding. */
export const RANGES = {
  sharpning: { min: -3, max: 9, step: 0.25, def: 2 },
  midRangeSharpning: { min: -5, max: 5, step: 0.25, def: 1 },
  clarity: { min: -5, max: 5, step: 0.25, def: 0.5 },
  contrast: { min: -100, max: 100, step: 1, def: 0 },
  highlights: { min: -100, max: 100, step: 1, def: 0 },
  shadows: { min: -100, max: 100, step: 1, def: 0 },
  whiteLevel: { min: -100, max: 100, step: 1, def: 0 },
  blackLevel: { min: -100, max: 100, step: 1, def: 0 },
  saturation: { min: -100, max: 100, step: 1, def: 0 },
} as const;
export type ScalarKey = keyof typeof RANGES;
export const SCALAR_KEYS = Object.keys(RANGES) as ScalarKey[];
/** Tone keys that the NP3 format disables when a custom tone curve is present. */
export const TONE_KEYS = ["contrast", "highlights", "shadows", "whiteLevel", "blackLevel"] as const;

export const NP_NAME_MAX = 19;
export const COMMENT_MAX = 256;

export function defaultParams(): RecipeParams {
  return {
    sharpning: RANGES.sharpning.def,
    midRangeSharpning: RANGES.midRangeSharpning.def,
    clarity: RANGES.clarity.def,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whiteLevel: 0,
    blackLevel: 0,
    saturation: 0,
    colorBlender: {},
    colorGrading: { blending: 50, balance: 0 },
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const snap = (v: number, step: number) => Math.round(v / step) * step;
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** Characters that are safe both in the NP3 name field and on the camera keyboard. */
export function sanitizeNpName(input: string): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 _\-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[ _]+|[ _]+$/g, "")
    .slice(0, NP_NAME_MAX)
    .trim();
  return cleaned.length > 0 ? cleaned : "RECIPE";
}

export function isValidNpName(name: string): boolean {
  return name.length >= 1 && name.length <= NP_NAME_MAX && /^[A-Za-z0-9 _\-]+$/.test(name);
}

function normalizeBlenderValues(v: ColorBlenderValues | undefined): ColorBlenderValues | undefined {
  if (!v) return undefined;
  const out = {
    hue: Math.round(clamp(num(v.hue, 0), -100, 100)),
    chroma: Math.round(clamp(num(v.chroma, 0), -100, 100)),
    brightness: Math.round(clamp(num(v.brightness, 0), -100, 100)),
  };
  return out.hue === 0 && out.chroma === 0 && out.brightness === 0 ? undefined : out;
}

function normalizeGradingValues(v: ColorGradingValues | undefined): ColorGradingValues | undefined {
  if (!v) return undefined;
  return {
    hue: ((Math.round(num(v.hue, 0)) % 360) + 360) % 360,
    chroma: Math.round(clamp(num(v.chroma, 0), -100, 100)),
    brightness: Math.round(clamp(num(v.brightness, 0), -100, 100)),
  };
}

/**
 * Snap every value to what the NP3 encoding can represent, so previews, text export
 * and the written file all agree.
 */
export function normalizeParams(p: Partial<RecipeParams>): RecipeParams {
  const out = defaultParams();
  for (const key of SCALAR_KEYS) {
    const r = RANGES[key];
    out[key] = snap(clamp(num(p[key], r.def), r.min, r.max), r.step);
  }
  const blender: ColorBlender = {};
  for (const c of BLENDER_COLORS) {
    const v = normalizeBlenderValues(p.colorBlender?.[c]);
    if (v) blender[c] = v;
  }
  out.colorBlender = blender;
  const g = p.colorGrading ?? {};
  const grading: ColorGrading = {
    blending: Math.round(clamp(num(g.blending, 50), 0, 100)),
    balance: Math.round(clamp(num(g.balance, 0), -100, 100)),
  };
  for (const r of GRADING_RANGES) {
    const v = normalizeGradingValues(g[r]);
    if (v && (v.hue !== 0 || v.chroma !== 0 || v.brightness !== 0)) grading[r] = v;
  }
  out.colorGrading = grading;
  if (p.toneCurve && p.toneCurve.raw.length === 257) {
    out.toneCurve = {
      raw: p.toneCurve.raw.map((v) => Math.round(clamp(num(v, 0), 0, 32767))),
      points: p.toneCurve.points.slice(0, 20).map((pt) => ({
        x: Math.round(clamp(pt.x, 0, 255)),
        y: Math.round(clamp(pt.y, 0, 255)),
      })),
    };
    // The format ignores these when a curve is present; keep them at 0 to match the file.
    for (const k of TONE_KEYS) out[k] = 0;
  }
  if (typeof p.comment === "string" && p.comment.length > 0) {
    out.comment = p.comment.replace(/\0/g, "").slice(0, COMMENT_MAX);
  }
  return out;
}

/** Bytes to write to the card. Imported files are passed through untouched. */
export function recipeToBytes(recipe: Recipe): Uint8Array {
  if (recipe.raw) return recipe.raw;
  if (!recipe.params) throw new Error(`Recipe ${recipe.id} has neither params nor raw bytes`);
  return serialize({ name: sanitizeNpName(recipe.npName), ...normalizeParams(recipe.params) });
}

export function paramsToBytes(npName: string, params: RecipeParams): Uint8Array {
  return serialize({ name: sanitizeNpName(npName), ...normalizeParams(params) });
}

/** The camera name lives in a 20-byte, NUL-padded field at offset 24. */
const NAME_OFFSET = 24;
const NAME_FIELD = 20;

/** Copy of an NP3 file with a different camera name; every other byte is kept as-is. */
export function withNpName(bytes: Uint8Array, name: string): Uint8Array {
  const clean = sanitizeNpName(name);
  const out = new Uint8Array(bytes);
  out.fill(0, NAME_OFFSET, NAME_OFFSET + NAME_FIELD);
  for (let i = 0; i < clean.length; i++) out[NAME_OFFSET + i] = clean.charCodeAt(i);
  return out;
}

export const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

const MAGIC = [0x4e, 0x43, 0x50, 0x00]; // "NCP\0"
const FLEXIBLE_VERSION = "0310";
const MIN_FLEXIBLE_LENGTH = 392;

export interface ParsedNp3 {
  npName: string;
  params: RecipeParams | null;
  /** Human-readable reason when params could not be parsed. */
  note?: "not-np3" | "unsupported-version";
}

/** Parse an NP3 file. Throws only when the bytes are clearly not a picture control. */
export function parseNp3(bytes: Uint8Array): ParsedNp3 {
  if (bytes.length < 16 || MAGIC.some((b, i) => bytes[i] !== b)) {
    throw new Error("not-np3");
  }
  const version = String.fromCharCode(...bytes.slice(12, 16));
  const rawName = String.fromCharCode(...bytes.slice(24, 43)).split("\0", 1)[0] ?? "";
  const npName = rawName.replace(/[^\x20-\x7e]/g, "").trim() || "IMPORTED";
  if (version !== FLEXIBLE_VERSION || bytes.length < MIN_FLEXIBLE_LENGTH) {
    return { npName, params: null, note: "unsupported-version" };
  }
  try {
    const { name: _ignored, ...rest } = deserialize(bytes);
    return { npName, params: normalizeParams(rest) };
  } catch {
    return { npName, params: null, note: "unsupported-version" };
  }
}

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}
