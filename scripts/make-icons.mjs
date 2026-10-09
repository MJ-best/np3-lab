// Generates the app icon and the menu-bar (template) icons as PNGs, with no image tools.
// Shapes are signed-distance functions, so edges are anti-aliased at any size.
// Run: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** `pixel(x, y)` returns straight (non-premultiplied) RGBA 0..255. `opaque` drops alpha (RGB PNG). */
function png(size, pixel, opaque = false) {
  const n = opaque ? 3 : 4;
  const raw = Buffer.alloc(size * (size * n + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * n + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const px = pixel(x + 0.5, y + 0.5);
      px.slice(0, n).forEach((v, i) => (raw[y * (size * n + 1) + 1 + x * n + i] = v));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Signed distance functions (units: 1024-unit design canvas) -------------

const roundBox = (px, py, x0, y0, x1, y1, r) => {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const qx = Math.abs(px - cx) - ((x1 - x0) / 2 - r);
  const qy = Math.abs(py - cy) - ((y1 - y0) / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const circle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;
/**
 * Isosceles trapezoid centred on cx, half-width `top` at y0 and `bottom` at y1 (y grows downwards),
 * rounded by r. Port of Inigo Quilez's sdTrapezoid.
 */
const trapezoid = (px, py, cx, y0, y1, top, bottom, r) => {
  const he = (y1 - y0) / 2;
  const x = Math.abs(px - cx);
  const y = py - (y0 + y1) / 2;
  const k2x = bottom - top;
  const k2y = 2 * he;
  const cax = x - Math.min(x, y < 0 ? top : bottom);
  const cay = Math.abs(y) - he;
  const t = Math.min(1, Math.max(0, ((bottom - x) * k2x + (he - y) * k2y) / (k2x * k2x + k2y * k2y)));
  const cbx = x - bottom + k2x * t;
  const cby = y - he + k2y * t;
  const sign = cbx < 0 && cay < 0 ? -1 : 1;
  return sign * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby)) - r;
};

/** Alpha of a shape from its distance, with ~1 output pixel of anti-aliasing. */
const cover = (d, unitsPerPixel) => Math.min(1, Math.max(0, 0.5 - d / unitsPerPixel));
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// --- Camera artwork ---------------------------------------------------------

const BODY = { x0: 192, y0: 420, x1: 832, y1: 760, r: 64 };
const HUMP = { cx: 540, y0: 318, y1: 440, top: 112, bottom: 168, r: 22 };
const DIAL_L = { x0: 262, y0: 384, x1: 372, y1: 432, r: 14 };
const DIAL_R = { x0: 690, y0: 384, x1: 800, y1: 432, r: 14 };
const LENS = { cx: 536, cy: 590, r: 128, ring: 13 };
const STRIPE = { x0: 287, y0: 498, x1: 297, y1: 700, r: 5 };

function cameraSdf(px, py) {
  return Math.min(
    roundBox(px, py, BODY.x0, BODY.y0, BODY.x1, BODY.y1, BODY.r),
    trapezoid(px, py, HUMP.cx, HUMP.y0, HUMP.y1, HUMP.top, HUMP.bottom, HUMP.r),
    roundBox(px, py, DIAL_L.x0, DIAL_L.y0, DIAL_L.x1, DIAL_L.y1, DIAL_L.r),
    roundBox(px, py, DIAL_R.x0, DIAL_R.y0, DIAL_R.x1, DIAL_R.y1, DIAL_R.r),
  );
}

const over = (dst, src, a) => dst.map((c, i) => c + (src[i] - c) * a);

/** Draw the camera (shadow, body, stripe, lens) over `rgb` at design point (px, py). */
/** Ellipse, rotated by `rot` radians; approximate distance, good enough for anti-aliasing. */
const ellipse = (px, py, cx, cy, rx, ry, rot = 0) => {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const x = (px - cx) * c + (py - cy) * s;
  const y = -(px - cx) * s + (py - cy) * c;
  return (Math.hypot(x / rx, y / ry) - 1) * Math.min(rx, ry);
};

/**
 * The app's mascot on Nikon yellow: a soft glowing dome rising from the bottom of the tile with two
 * dark eyes. Design units are the 1024 canvas with the tile at 100–924; points outside it carry on
 * the same picture, so full-bleed icons can use a wider window.
 */
function paintMascot(px, py, k) {
  // Nikon yellow, a touch deeper at the top.
  let rgb = over([242, 178, 0], [255, 214, 0], Math.min(1, Math.max(0, (py - 100) / 600)));
  const dome = ellipse(px, py, 512, 830, 470, 450);
  // Light spills a little past the dome's edge.
  rgb = over(rgb, [255, 246, 200], (1 - smooth(-10, 70, dome)) * 0.35);
  const r = Math.hypot((px - 512) / 470, (py - 800) / 450);
  rgb = over(rgb, over([255, 205, 0], [255, 252, 232], smooth(0.25, 1, r)), cover(dome, k * 3));
  for (const [cx, cy, rot] of [
    [428, 660, -0.08],
    [598, 624, 0.08],
  ]) {
    const eye = over([18, 18, 18], [52, 48, 40], smooth(-76, 30, py - cy));
    rgb = over(rgb, eye, cover(ellipse(px, py, cx, cy, 56, 76, rot), k));
  }
  return rgb;
}

function paintCamera(rgb, px, py, k) {
  // Camera: drop shadow, body with a slight top highlight.
  const camD = cameraSdf(px, py);
  rgb = over(rgb, [60, 50, 35], 0.22 * (1 - smooth(-6, 30, cameraSdf(px, py - 16))));
  const bodyShade = 26 - 16 * smooth(BODY.y0 - 110, BODY.y1, py);
  rgb = over(rgb, [bodyShade, bodyShade, bodyShade], cover(camD, k));

  // Red accent stripe on the grip.
  rgb = over(rgb, [210, 44, 36], cover(roundBox(px, py, STRIPE.x0, STRIPE.y0, STRIPE.x1, STRIPE.y1, STRIPE.r), k));

  // Lens: white ring, dark glass, highlight arc and glint.
  const d = circle(px, py, LENS.cx, LENS.cy, LENS.r - LENS.ring / 2);
  rgb = over(rgb, [244, 244, 240], cover(Math.abs(d) - LENS.ring / 2, k));
  rgb = over(rgb, [10, 10, 10], cover(circle(px, py, LENS.cx, LENS.cy, LENS.r - LENS.ring), k));
  const ang = (Math.atan2(py - LENS.cy, px - LENS.cx) * 180) / Math.PI; // -180..180, 0 = right, -90 = up
  const arcA = cover(Math.abs(circle(px, py, LENS.cx, LENS.cy, 88)) - 6, k) * smooth(-172, -160, ang) * (1 - smooth(-112, -100, ang));
  rgb = over(rgb, [236, 236, 232], arcA);
  return rgb;
}

function appIcon(size) {
  const k = 1024 / size;
  const TILE = { x0: 100, y0: 100, x1: 924, y1: 924, r: 185 };
  return png(size, (x, y) => {
    const px = x * k;
    const py = y * k;
    // Soft shadow under the tile, then the tile.
    const shadow = 0.28 * (1 - smooth(-10, 26, roundBox(px, py - 12, TILE.x0, TILE.y0, TILE.x1, TILE.y1, TILE.r)));
    const tileA = cover(roundBox(px, py, TILE.x0, TILE.y0, TILE.x1, TILE.y1, TILE.r), k);
    if (tileA === 0) return [0, 0, 0, Math.round(shadow * 255)];
    const alpha = shadow + tileA * (1 - shadow);
    // Straight alpha: the tile's colour, weighted by how much of the pixel is tile rather than shadow.
    const rgb = paintMascot(px, py, k).map((c) => (c * tileA) / alpha);
    return [...rgb.map(Math.round), Math.round(alpha * 255)];
  });
}

function trayIcon(size) {
  // Template image: black + alpha; macOS recolours it for light/dark menu bars.
  const k = 1024 / size;
  return png(size, (x, y) => {
    // Map the square onto the camera (x 192–832, y 318–760) with a small margin.
    const scale = 0.68;
    const px = 164 + x * k * scale;
    const py = 199 + y * k * scale;
    const body = cover(cameraSdf(px, py), k * scale);
    const gap = cover(Math.abs(circle(px, py, LENS.cx, LENS.cy, LENS.r - 6)) - 22, k * scale);
    const a = body * (1 - gap);
    return [0, 0, 0, Math.round(a * 255)];
  });
}

const out = (rel, buf) => {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
  console.log("wrote", rel);
};
/**
 * The mascot full-bleed (no tile): `window` of the canvas shows the tile area 100–924, the rest
 * carries on the picture. `round` cuts a circle for Android's legacy round icon.
 */
function mascotBleed(size, window, { round = false, opaque = false } = {}) {
  const k = 824 / (window * size);
  return png(
    size,
    (x, y) => {
      const px = 512 + (x - size / 2) * k;
      const py = 512 + (y - size / 2) * k;
      const a = round ? cover(Math.hypot(x - size / 2, y - size / 2) - size * 0.46, 1) : 1;
      return [...paintMascot(px, py, k).map(Math.round), Math.round(a * 255)];
    },
    opaque,
  );
}

out("build/icon.png", appIcon(1024));
out("electron/assets/trayTemplate.png", trayIcon(18));
out("electron/assets/trayTemplate@2x.png", trayIcon(36));

const RES = "android/app/src/main/res";
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, scale] of Object.entries(DENSITIES)) {
  // Legacy icons (Android 7) are 48dp; the adaptive foreground is 108dp with a 72dp visible area.
  out(`${RES}/mipmap-${name}/ic_launcher.png`, appIcon(48 * scale));
  out(`${RES}/mipmap-${name}/ic_launcher_round.png`, mascotBleed(48 * scale, 1, { round: true }));
  // The launcher shows the middle 72 of the 108dp foreground; that's where the tile goes.
  out(`${RES}/mipmap-${name}/ic_launcher_foreground.png`, mascotBleed(108 * scale, 72 / 108));
}

// iOS: one 1024 px icon, square and opaque (iOS rounds the corners; the App Store rejects alpha).
out("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", mascotBleed(1024, 1, { opaque: true }));
