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
/** `pixel(x, y)` returns straight (non-premultiplied) RGBA 0..255. */
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
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
    // Soft shadow under the tile, then the cream tile.
    const shadow = 0.28 * (1 - smooth(-10, 26, roundBox(px, py - 12, TILE.x0, TILE.y0, TILE.x1, TILE.y1, TILE.r)));
    const tileA = cover(roundBox(px, py, TILE.x0, TILE.y0, TILE.x1, TILE.y1, TILE.r), k);
    let rgb = [0, 0, 0];
    let alpha = shadow;
    const t = (py - TILE.y0) / (TILE.y1 - TILE.y0);
    const cream = [245 - 10 * t, 241 - 12 * t, 232 - 16 * t];
    if (tileA > 0) {
      rgb = over(rgb, cream, tileA / Math.max(alpha + tileA * (1 - alpha), 1e-6));
      alpha = alpha + tileA * (1 - alpha);
    }
    if (tileA === 0) return [0, 0, 0, Math.round(alpha * 255)];

    rgb = paintCamera(rgb, px, py, k);
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
// Android: flat cream behind the camera (adaptive icon background, legacy round icon).
const CREAM = [242, 238, 228];

/**
 * Camera only, on transparency, `width` of the canvas wide. The colours are un-premultiplied
 * against CREAM so that, laid over it, the result matches the Mac icon (shadow included).
 */
function cameraOnly(size, width, tile) {
  const k = 640 / (width * size); // the camera is 640 design units wide (x 192–832)
  return png(size, (x, y) => {
    const px = 512 + (x - size / 2) * k;
    const py = 539 + (y - size / 2) * k; // vertical centre of hump + body (y 318–760)
    const body = cover(cameraSdf(px, py), k);
    const shadow = 0.22 * (1 - smooth(-6, 30, cameraSdf(px, py - 16)));
    const target = paintCamera(CREAM, px, py, k);
    if (tile) {
      const a = cover(Math.hypot(x - size / 2, y - size / 2) - size * 0.46, 1);
      return [...target.map(Math.round), Math.round(a * 255)];
    }
    const a = body + shadow * (1 - body);
    if (a <= 0) return [0, 0, 0, 0];
    const rgb = target.map((c, i) => Math.min(255, Math.max(0, (c - CREAM[i] * (1 - a)) / a)));
    return [...rgb.map(Math.round), Math.round(a * 255)];
  });
}

out("build/icon.png", appIcon(1024));
out("electron/assets/trayTemplate.png", trayIcon(18));
out("electron/assets/trayTemplate@2x.png", trayIcon(36));

const RES = "android/app/src/main/res";
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, scale] of Object.entries(DENSITIES)) {
  // Legacy icons (Android 7) are 48dp; the adaptive foreground is 108dp with a 72dp visible area.
  out(`${RES}/mipmap-${name}/ic_launcher.png`, appIcon(48 * scale));
  out(`${RES}/mipmap-${name}/ic_launcher_round.png`, cameraOnly(48 * scale, 0.6, true));
  // 0.5 of 108dp keeps the camera inside the 66dp safe circle of any launcher mask.
  out(`${RES}/mipmap-${name}/ic_launcher_foreground.png`, cameraOnly(108 * scale, 0.5, false));
}
