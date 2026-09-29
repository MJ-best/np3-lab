import type { ToneCurve } from "./recipe";

export interface CurvePoint {
  x: number;
  y: number;
}

export const MAX_CURVE_POINTS = 20;
export const RAW_LENGTH = 257;
export const RAW_MAX = 32767;

export const IDENTITY_POINTS: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

/** Sort, clamp, dedupe by x (last wins) and cap the number of points. */
export function cleanPoints(points: readonly CurvePoint[]): CurvePoint[] {
  const byX = new Map<number, number>();
  for (const p of points) {
    const x = Math.round(Math.min(255, Math.max(0, p.x)));
    const y = Math.round(Math.min(255, Math.max(0, p.y)));
    byX.set(x, y);
  }
  const sorted = [...byX.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
  if (sorted.length === 0) return IDENTITY_POINTS.map((p) => ({ ...p }));
  if (sorted.length === 1) return [{ x: 0, y: sorted[0].y }, { x: 255, y: sorted[0].y }];
  return sorted.slice(0, MAX_CURVE_POINTS);
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson). Monotone input points never
 * overshoot, which keeps the curve free of the wiggles a plain spline produces.
 */
export function makeInterpolator(points: readonly CurvePoint[]): (x: number) => number {
  const pts = cleanPoints(points);
  const n = pts.length;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const d: number[] = [];
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return (x: number) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

/** 257-entry LUT (0..32767) sampled at input i/256, as stored in the NP3 file. */
export function pointsToRaw(points: readonly CurvePoint[]): number[] {
  const f = makeInterpolator(points);
  return Array.from({ length: RAW_LENGTH }, (_, i) => {
    const y = f((i / 256) * 255) / 255;
    return Math.round(Math.min(1, Math.max(0, y)) * RAW_MAX);
  });
}

export function toneCurveFromPoints(points: readonly CurvePoint[]): ToneCurve {
  const clean = cleanPoints(points);
  return { raw: pointsToRaw(clean), points: clean };
}

export function isIdentityCurve(curve: ToneCurve | undefined): boolean {
  if (!curve) return true;
  return curve.raw.every((v, i) => Math.abs(v - (i / 256) * RAW_MAX) < 64);
}

export const CURVE_PRESETS: Record<string, CurvePoint[]> = {
  linear: IDENTITY_POINTS,
  sCurve: [
    { x: 0, y: 0 },
    { x: 64, y: 50 },
    { x: 192, y: 208 },
    { x: 255, y: 255 },
  ],
  fade: [
    { x: 0, y: 28 },
    { x: 128, y: 128 },
    { x: 255, y: 240 },
  ],
  matte: [
    { x: 0, y: 36 },
    { x: 60, y: 62 },
    { x: 190, y: 196 },
    { x: 255, y: 236 },
  ],
};
