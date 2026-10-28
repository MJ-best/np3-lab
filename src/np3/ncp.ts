import type { ColorBlender, RecipeParams } from "./recipe";
import { RAW_LENGTH, RAW_MAX, type CurvePoint } from "./toneCurve";

/*
 * Original Picture Control files (.NCP, version "0100"): what every Nikon with custom
 * Picture Controls can load, including the Z5, Z6, Z7, Z50, Z fc and Z30, which can't
 * load Flexible Color. Layout (638 bytes), read from files made by Nikon's software:
 *   0x00  "NCP\0" 00000001 00000024 "0100"
 *   0x10  camera name, 20 bytes, NUL-padded
 *   0x24  base: 03C2 02FF Neutral, 064D 00FF Monochrome
 *   0x28  sharpening, contrast, brightness, saturation, hue, filter, toning, toning strength:
 *         0x80 + value; 0x01 = set by the custom curve; 0xFF = not used by this base
 *   0x30  00000002 00000242 "I0" (the curve block follows)
 *   0x3A  curve levels: input black, input white, output black, output white, gamma (01 00 = 1.00)
 *   0x40  number of curve points, then x,y byte pairs (up to 20)
 *   0x78  the curve: 257 big-endian u16 values, 0..32767
 */

export interface NcpParams {
  mono: boolean;
  /** 0..9 */
  sharpening: number;
  /** -3..3; colour bases only. */
  saturation: number;
  /** -3..3; colour bases only. */
  hue: number;
  /** Monochrome filter: 0 off, 1 yellow, 2 orange, 3 red, 4 green. */
  filter: number;
  /** Monochrome toning: 0 black & white, 1 sepia, 2 cyanotype, 3 red … 9 red purple. */
  toning: number;
  /** 257 values, 0..32767. */
  curve: number[];
  points: CurvePoint[];
}

const SIZE = 638;
const CURVE_AT = 0x78;
const NEUTRAL = [0x03, 0xc2, 0x02, 0xff];
const MONO = [0x06, 0x4d, 0x00, 0xff];
/** One step of a classic slider, in Flexible Color units (±3 spans the same range as ±100). */
const STEP = 100 / 3;
/** One classic hue step, in colour-blender hue units (the preview turns 25° per 100). */
const HUE_STEP = 12;
/** Grading hue for each toning (sepia, cyanotype, red, yellow, green, blue green, blue, purple blue, red purple). */
const TONING_HUE = [0, 40, 215, 0, 60, 120, 170, 230, 260, 320];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

export const isNcp = (b: Uint8Array) =>
  b.length >= SIZE && b[0] === 0x4e && b[1] === 0x43 && b[2] === 0x50 && b[3] === 0 && String.fromCharCode(...b.slice(12, 16)) === "0100";

const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const invSmooth = (v: number) => 0.5 - Math.sin(Math.asin(1 - 2 * clamp(v, 0, 1)) / 3);

// ponytail: mirrors the tone step in render/shaders.ts for a grey pixel; keep the two in step.
/** What the preview's tone sliders do to a grey level 0..1. */
function toneAt(x: number, p: Partial<RecipeParams>): number {
  const k = (p.contrast ?? 0) / 100;
  const c = k >= 0 ? x + (smooth(0, 1, x) - x) * k : x + (invSmooth(x) - x) * -k * 0.85;
  const d =
    ((p.highlights ?? 0) / 100) * 0.24 * smooth(0.45, 1, c) +
    ((p.shadows ?? 0) / 100) * 0.2 * smooth(0, 0.1, c) * (1 - smooth(0.1, 0.55, c)) +
    ((p.whiteLevel ?? 0) / 100) * 0.14 * smooth(0.6, 1, c) +
    ((p.blackLevel ?? 0) / 100) * 0.1 * (1 - smooth(0, 0.35, c));
  return clamp(c + d, 0, 1);
}

const curveFrom = (f: (x: number) => number) => Array.from({ length: RAW_LENGTH }, (_, i) => Math.round(clamp(f(i / 256), 0, 1) * RAW_MAX));

/** Nine points on the curve, so NX Studio and the camera's curve view show its shape. */
function pointsOf(curve: number[]): CurvePoint[] {
  return [0, 32, 64, 96, 128, 160, 192, 224, 255].map((x) => ({ x, y: Math.round((curve[Math.round((x * 256) / 255)] / RAW_MAX) * 255) }));
}

export function parseNcp(b: Uint8Array): NcpParams | null {
  if (!isNcp(b)) return null;
  const mono = b[0x24] === 0x06 && b[0x25] === 0x4d;
  const step = (v: number, min: number, max: number) => (v === 0xff || v === 0x01 ? 0 : clamp(v - 0x80, min, max));
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let curve = Array.from({ length: RAW_LENGTH }, (_, i) => Math.min(RAW_MAX, view.getUint16(CURVE_AT + 2 * i)));
  // Made with the contrast and brightness sliders instead of a curve: draw those as one.
  if (b[0x29] !== 0x01) {
    const contrast = step(b[0x29], -3, 3) * STEP;
    const brightness = step(b[0x2a], -1, 1);
    curve = curveFrom((x) => toneAt(x, { contrast }) + brightness * 0.06 * Math.sin(Math.PI * x));
  }
  const points: CurvePoint[] = [];
  for (let i = 0; i < Math.min(b[0x40], 20); i++) points.push({ x: b[0x41 + 2 * i], y: b[0x42 + 2 * i] });
  return {
    mono,
    sharpening: step(b[0x28], 0, 9),
    saturation: mono ? 0 : step(b[0x2b], -3, 3),
    hue: mono ? 0 : step(b[0x2c], -3, 3),
    filter: mono ? step(b[0x2d], 0, 4) : 0,
    toning: mono ? step(b[0x2e], 0, 9) : 0,
    curve,
    points: points.length >= 2 ? points : pointsOf(curve),
  };
}

export function ncpBytes(name: string, p: NcpParams): Uint8Array {
  const b = new Uint8Array(SIZE);
  b.set([0x4e, 0x43, 0x50, 0, 0, 0, 0, 1, 0, 0, 0, 0x24, ...ascii("0100")], 0);
  b.set(ascii(name.replace(/[^\x20-\x7e]/g, "").slice(0, 19)), 0x10);
  b.set(p.mono ? MONO : NEUTRAL, 0x24);
  const s = (v: number) => 0x80 + v;
  b.set(
    [s(p.sharpening), 0x01, 0x01, p.mono ? 0xff : s(p.saturation), p.mono ? 0xff : s(p.hue), p.mono ? s(p.filter) : 0xff, p.mono ? s(p.toning) : 0xff, 0xff],
    0x28,
  );
  b.set([0, 0, 0, 2, 0, 0, 0x02, 0x42, 0x49, 0x30, 0x00, 0xff, 0x00, 0xff, 0x01, 0x00], 0x30);
  const points = p.points.slice(0, 20);
  b[0x40] = points.length;
  points.forEach((pt, i) => b.set([pt.x, pt.y], 0x41 + 2 * i));
  const view = new DataView(b.buffer);
  p.curve.forEach((v, i) => view.setUint16(CURVE_AT + 2 * i, clamp(Math.round(v), 0, RAW_MAX)));
  return b;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * A Flexible Color recipe as an original Picture Control: the tone (sliders or curve) becomes
 * the custom curve, saturation carries over (with the blender's overall chroma), and a
 * monochrome recipe gets the filter its blender comes closest to. Blender hues and colour
 * grading have no counterpart and are left out.
 */
export function toNcp(p: RecipeParams): NcpParams {
  const mono = (p.saturation ?? 0) <= -100;
  const curve = p.toneCurve?.raw.length === RAW_LENGTH ? p.toneCurve.raw.slice() : curveFrom((x) => toneAt(x, p));
  const bands = Object.values(p.colorBlender ?? {});
  const chroma = mean([...bands.map((v) => v?.chroma ?? 0), ...Array(8 - bands.length).fill(0)]);
  const light = (c: keyof ColorBlender) => p.colorBlender?.[c]?.brightness ?? 0;
  const warm = mean([light("red"), light("orange"), light("yellow")]) - mean([light("blue"), light("cyan")]);
  const filter = !mono ? 0 : light("green") - light("red") > 25 ? 4 : warm > 45 ? 3 : warm > 25 ? 2 : warm > 10 ? 1 : 0;
  return {
    mono,
    sharpening: clamp(Math.round(p.sharpning ?? 2), 0, 9),
    saturation: mono ? 0 : clamp(Math.round(((p.saturation ?? 0) + chroma * 0.85) / STEP), -3, 3),
    hue: 0,
    filter,
    toning: 0,
    curve,
    points: pointsOf(curve),
  };
}

/** What an original Picture Control looks like in the preview (filters can't be shown). */
export function ncpToParams(n: NcpParams): RecipeParams {
  const blender: ColorBlender = {};
  if (n.hue) for (const c of ["red", "orange", "yellow", "green", "cyan", "blue", "purple", "magenta"] as const) blender[c] = { hue: n.hue * HUE_STEP, chroma: 0, brightness: 0 };
  const tint = n.mono && n.toning ? { hue: TONING_HUE[n.toning], chroma: 12, brightness: 0 } : undefined;
  return {
    sharpning: n.sharpening,
    midRangeSharpning: 1,
    clarity: 0.5,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whiteLevel: 0,
    blackLevel: 0,
    saturation: n.mono ? -100 : n.saturation * STEP,
    colorBlender: blender,
    colorGrading: tint ? { blending: 50, balance: 0, shadows: tint, midTone: tint, highlights: tint } : { blending: 50, balance: 0 },
    toneCurve: { raw: n.curve, points: n.points },
  };
}
