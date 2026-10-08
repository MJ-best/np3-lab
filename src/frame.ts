import { cameraName, dateText, settingsParts, type PhotoExif } from "./exif";

/*
 * Frames for sharing a photo: the picture with its recipe name and shooting details
 * set around it. Drawn on a canvas at the photo's own resolution.
 *
 * Layouts follow what EXIF-frame apps commonly offer (bottom bar, Polaroid, film strip,
 * cinematic letterbox, poster, minimal border, text over the photo), plus a recipe card
 * that lists the recipe's own settings.
 */

export type FrameLayout = "strap" | "polaroid" | "gallery" | "minimal" | "poster" | "recipe" | "film" | "cinema" | "overlay";
export const FRAME_LAYOUTS: FrameLayout[] = ["strap", "polaroid", "gallery", "minimal", "poster", "recipe", "film", "cinema", "overlay"];

export type FrameTone = "light" | "cream" | "dark";
export const FRAME_TONES: FrameTone[] = ["light", "cream", "dark"];

/** Canvas shape: the frame's own, or padded out to a social-media aspect ratio. */
export type FrameRatio = "auto" | "1:1" | "4:5" | "9:16";
export const FRAME_RATIOS: FrameRatio[] = ["auto", "1:1", "4:5", "9:16"];

export interface FrameOptions {
  layout: FrameLayout;
  tone: FrameTone;
  ratio: FrameRatio;
  /** Focal length, aperture, shutter, ISO. */
  showSettings: boolean;
  /** Camera and lens. */
  showGear: boolean;
  showDate: boolean;
}

export const DEFAULT_FRAME: FrameOptions = { layout: "strap", tone: "light", ratio: "auto", showSettings: true, showGear: true, showDate: true };

/** Layouts with their own colours: the tone choice doesn't apply. */
export const FIXED_TONE: FrameLayout[] = ["film", "cinema", "overlay"];

export interface FrameInfo {
  /** The recipe's name as shown in the app. */
  title: string;
  /** The name the camera shows (NP3, ASCII). */
  npName: string;
  exif?: PhotoExif;
  /** The recipe's changed settings, already labelled ("Contrast", "+80"), for the recipe card. */
  params?: [string, string][];
  /** CSS colours of the colour-blender bands and grading ranges the recipe moves. */
  swatches?: string[];
}

const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", "Pretendard", "Hiragino Sans", "Segoe UI", "Malgun Gothic", Roboto, sans-serif';
const SERIF = '"New York", Georgia, "Times New Roman", "Apple SD Gothic Neo", "Noto Serif", serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';
const NIKON_YELLOW = "#ffe100";

const TONES: Record<FrameTone, { bg: string; ink: string; sub: string; line: string }> = {
  light: { bg: "#ffffff", ink: "#141414", sub: "#8a8a8a", line: "#e6e6e6" },
  cream: { bg: "#f3eee3", ink: "#2a2520", sub: "#8f8678", line: "#e0d8c8" },
  dark: { bg: "#111111", ink: "#f1f1f1", sub: "#8c8c8c", line: "#2a2a2a" },
};

type Ctx = CanvasRenderingContext2D;

/** Shrink `size` until `text` fits in `maxWidth`. */
function fit(ctx: Ctx, text: string, maxWidth: number, size: number, family: string, weight = "400", style = "") {
  let s = size;
  const font = () => `${style} ${weight} ${s}px ${family}`.trim();
  ctx.font = font();
  while (s > 8 && ctx.measureText(text).width > maxWidth) {
    s *= 0.94;
    ctx.font = font();
  }
}

interface Text {
  size: number;
  color: string;
  family?: string;
  weight?: string;
  style?: string;
  align?: CanvasTextAlign;
  max: number;
  /** Letter spacing in px (where the browser supports it). */
  track?: number;
}

function text(ctx: Ctx, s: string, x: number, y: number, o: Text) {
  if (!s) return;
  const c = ctx as Ctx & { letterSpacing?: string };
  c.letterSpacing = `${o.track ?? 0}px`;
  fit(ctx, s, o.max, o.size, o.family ?? SANS, o.weight, o.style);
  ctx.fillStyle = o.color;
  ctx.textAlign = o.align ?? "left";
  ctx.fillText(s, x, y);
  c.letterSpacing = "0px";
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** The frame's content: its size and how to draw it with the top-left at (0, 0). */
interface Block {
  w: number;
  h: number;
  /** Background for the whole canvas (also the padding added for an aspect ratio). */
  bg: string;
  draw(ctx: Ctx): void;
}

function layoutBlock(bmp: ImageBitmap, info: FrameInfo, o: FrameOptions): Block {
  const w = bmp.width;
  const h = bmp.height;
  // One unit = 1% of the photo's average side, so portrait and landscape frames look alike.
  const u = (w + h) / 200;
  const e = info.exif ?? {};
  const settings = o.showSettings ? settingsParts(e) : [];
  const camera = o.showGear ? (cameraName(e) ?? "") : "";
  const lens = o.showGear ? (e.lens ?? "") : "";
  const date = o.showDate ? (dateText(e) ?? "") : "";
  const gear = [camera, lens].filter(Boolean).join("  ·  ");
  const t = TONES[o.tone];
  const photo = (ctx: Ctx, x: number, y: number) => ctx.drawImage(bmp, x, y);
  const join = (parts: string[], sep = "   ·   ") => parts.filter(Boolean).join(sep);

  switch (o.layout) {
    case "strap": {
      // A bar under the photo: recipe and camera on the left, settings on the right.
      const bar = 11 * u;
      return {
        w,
        h: h + bar,
        bg: t.bg,
        draw(ctx) {
          photo(ctx, 0, 0);
          const half = w / 2 - 6 * u;
          const lone = !camera && !settings.length && !lens && !date;
          const y1 = h + (lone ? 6.3 : 5) * u;
          const y2 = h + 8.2 * u;
          ctx.fillStyle = NIKON_YELLOW;
          ctx.fillRect(4 * u, y1 - 2.1 * u, 0.6 * u, 2.4 * u);
          text(ctx, info.title, 5.5 * u, y1, { size: 2.4 * u, color: t.ink, weight: "700", max: half });
          text(ctx, camera, 5.5 * u, y2, { size: 1.7 * u, color: t.sub, weight: "500", max: half });
          text(ctx, settings.join("   "), w - 4 * u, y1, { size: 2.1 * u, color: t.ink, weight: "600", align: "right", max: half });
          text(ctx, join([lens, date], "  ·  "), w - 4 * u, y2, { size: 1.6 * u, color: t.sub, align: "right", max: half });
        },
      };
    }
    case "polaroid": {
      // Instant-film proportions: even sides, a deep bottom with the name written in.
      const side = 4.5 * u;
      const bottom = 21 * u;
      return {
        w: w + 2 * side,
        h: h + side + bottom,
        bg: t.bg,
        draw(ctx) {
          photo(ctx, side, side);
          const y = side + h;
          const max = w * 0.62;
          text(ctx, info.title, side + 1.5 * u, y + 10 * u, { size: 4 * u, color: t.ink, family: SERIF, style: "italic", max });
          text(ctx, join([gear, settings.join(" ")]), side + 1.5 * u, y + 14.5 * u, { size: 1.5 * u, color: t.sub, max: w - 3 * u });
          text(ctx, date, side + w - 1.5 * u, y + 10 * u, { size: 1.8 * u, color: t.sub, family: MONO, align: "right", max: w * 0.3 });
        },
      };
    }
    case "gallery": {
      // A print in a mat: the name centred in italic serif, details in one quiet line.
      const side = 6 * u;
      const bottom = 20 * u;
      return {
        w: w + 2 * side,
        h: h + side + bottom,
        bg: t.bg,
        draw(ctx) {
          photo(ctx, side, side);
          const cx = side + w / 2;
          const y = side + h;
          text(ctx, info.title, cx, y + 9.5 * u, { size: 3.4 * u, color: t.ink, family: SERIF, style: "italic", align: "center", max: w });
          ctx.fillStyle = NIKON_YELLOW;
          ctx.fillRect(cx - 2 * u, y + 11.6 * u, 4 * u, 0.3 * u);
          text(ctx, join([camera, settings.join("  "), date]), cx, y + 14.8 * u, { size: 1.6 * u, color: t.sub, weight: "500", align: "center", max: w });
        },
      };
    }
    case "minimal": {
      // A thin even border and one small line.
      const side = 2.5 * u;
      const bottom = 7 * u;
      return {
        w: w + 2 * side,
        h: h + side + bottom,
        bg: t.bg,
        draw(ctx) {
          photo(ctx, side, side);
          const y = side + h + 4.6 * u;
          text(ctx, info.title, side, y, { size: 1.8 * u, color: t.ink, weight: "600", max: w * 0.45 });
          text(ctx, join([settings.join("  "), date], "  ·  "), side + w, y, { size: 1.5 * u, color: t.sub, align: "right", max: w * 0.52 });
        },
      };
    }
    case "poster": {
      // Magazine cover: the recipe name large above the photo.
      const side = 5 * u;
      const top = 19 * u;
      const bottom = 10 * u;
      return {
        w: w + 2 * side,
        h: h + top + bottom,
        bg: t.bg,
        draw(ctx) {
          text(ctx, info.npName.toUpperCase(), side, 5.5 * u, { size: 1.5 * u, color: t.sub, family: MONO, max: w, track: 0.3 * u });
          text(ctx, info.title, side - 0.3 * u, 14.5 * u, { size: 8 * u, color: t.ink, weight: "800", max: w, track: -0.15 * u });
          ctx.fillStyle = NIKON_YELLOW;
          ctx.fillRect(side, 16.4 * u, 6 * u, 0.5 * u);
          photo(ctx, side, top);
          const y = top + h + 5.8 * u;
          text(ctx, gear, side, y, { size: 1.6 * u, color: t.ink, weight: "600", max: w * 0.5 });
          text(ctx, join([settings.join("  "), date], "  ·  "), side + w, y, { size: 1.6 * u, color: t.sub, align: "right", max: w * 0.48 });
        },
      };
    }
    case "recipe": {
      // A recipe card: the photo with the settings that make the look. Beside a landscape
      // photo, under a portrait one.
      const rows = info.params ?? [];
      const swatches = info.swatches ?? [];
      const beside = w > h;
      const pad = 4 * u;
      const rowH = 3 * u;
      const cols = beside ? 1 : 2;
      const listH = Math.ceil(rows.length / cols) * rowH;
      const footer = [gear, settings.join("  "), date].filter(Boolean);
      const panelW = beside ? 34 * u : w;
      const panelH = beside ? h : 12 * u + listH + (swatches.length ? 4 * u : 0) + footer.length * 2.6 * u + 5 * u;
      return {
        w: beside ? w + panelW : w,
        h: beside ? h : h + panelH,
        bg: t.bg,
        draw(ctx) {
          photo(ctx, 0, 0);
          const x0 = (beside ? w : 0) + pad;
          let y = (beside ? 0 : h) + pad + 3 * u;
          const inner = panelW - 2 * pad;
          text(ctx, info.title, x0, y, { size: 3 * u, color: t.ink, weight: "700", max: inner });
          y += 2.8 * u;
          text(ctx, info.npName, x0, y, { size: 1.5 * u, color: t.sub, family: MONO, max: inner });
          y += 2 * u;
          ctx.fillStyle = NIKON_YELLOW;
          ctx.fillRect(x0, y, 4 * u, 0.35 * u);
          y += 3.6 * u;
          const colW = inner / cols;
          rows.forEach(([k, v], i) => {
            const cx = x0 + (i % cols) * colW;
            const cy = y + Math.floor(i / cols) * rowH;
            text(ctx, k, cx, cy, { size: 1.6 * u, color: t.sub, max: colW * 0.62 });
            text(ctx, v, cx + colW - 2 * u, cy, { size: 1.6 * u, color: t.ink, family: MONO, weight: "600", align: "right", max: colW * 0.35 });
          });
          y += listH + 0.5 * u;
          swatches.forEach((c, i) => {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(x0 + 1 * u + i * 2.8 * u, y, 1 * u, 0, Math.PI * 2);
            ctx.fill();
          });
          if (swatches.length) y += 4 * u;
          let fy = beside ? h - pad - (footer.length - 1) * 2.6 * u : y + 1 * u;
          for (const line of footer) {
            text(ctx, line, x0, fy, { size: 1.5 * u, color: t.sub, max: inner });
            fy += 2.6 * u;
          }
        },
      };
    }
    case "film": {
      // A strip of negative: sprocket holes and amber edge lettering.
      const side = 3 * u;
      const top = 6 * u;
      const bottom = 15 * u;
      const holes = (ctx: Ctx, y: number, W: number) => {
        ctx.fillStyle = "#2c2a26";
        for (let x = 1.5 * u; x < W - 2 * u; x += 4.6 * u) roundRect(ctx, x, y, 2.4 * u, 2.6 * u, 0.5 * u);
      };
      return {
        w: w + 2 * side,
        h: h + top + bottom,
        bg: "#0b0b0b",
        draw(ctx) {
          const W = w + 2 * side;
          holes(ctx, 1.7 * u, W);
          photo(ctx, side, top);
          const y = top + h;
          const half = w / 2 - 2 * u;
          const amber = "#f2a33a";
          text(ctx, `▸ ${info.npName.toUpperCase()}`, side, y + 4.4 * u, { size: 2.2 * u, color: amber, family: MONO, weight: "600", max: half });
          text(ctx, settings.join("  "), side + w, y + 4.4 * u, { size: 1.9 * u, color: "#e9e4da", family: MONO, align: "right", max: half });
          text(ctx, info.title !== info.npName ? info.title : camera, side, y + 7.4 * u, { size: 1.6 * u, color: "#9a9488", max: half });
          text(ctx, join([info.title !== info.npName ? camera : "", date], "  ·  "), side + w, y + 7.4 * u, { size: 1.6 * u, color: "#9a9488", family: MONO, align: "right", max: half });
          holes(ctx, y + 10.6 * u, W);
        },
      };
    }
    case "cinema": {
      // Letterbox: black bars, the name spaced out like a title card.
      const top = 8 * u;
      const bottom = 13 * u;
      return {
        w,
        h: h + top + bottom,
        bg: "#000000",
        draw(ctx) {
          text(ctx, gear.toUpperCase(), w / 2, 5 * u, { size: 1.3 * u, color: "#7b7b7b", family: MONO, align: "center", max: w * 0.9, track: 0.25 * u });
          photo(ctx, 0, top);
          const y = top + h;
          text(ctx, info.title.toUpperCase(), w / 2, y + 6 * u, { size: 2.6 * u, color: "#f4f4f4", weight: "500", align: "center", max: w * 0.9, track: 0.6 * u });
          text(ctx, join([settings.join("   "), date]), w / 2, y + 9.8 * u, { size: 1.4 * u, color: "#8f8f8f", family: MONO, align: "center", max: w * 0.9 });
        },
      };
    }
    case "overlay": {
      // No border: the details over the photo, on a soft shadow.
      return {
        w,
        h,
        bg: "#000000",
        draw(ctx) {
          photo(ctx, 0, 0);
          const g = ctx.createLinearGradient(0, h - 24 * u, 0, h);
          g.addColorStop(0, "rgba(0,0,0,0)");
          g.addColorStop(1, "rgba(0,0,0,0.62)");
          ctx.fillStyle = g;
          ctx.fillRect(0, h - 24 * u, w, 24 * u);
          const half = w / 2 - 5 * u;
          ctx.fillStyle = NIKON_YELLOW;
          ctx.fillRect(4 * u, h - 9.6 * u, 0.6 * u, 2.6 * u);
          text(ctx, info.title, 5.5 * u, h - 7.3 * u, { size: 2.8 * u, color: "#ffffff", weight: "700", max: half });
          text(ctx, gear, 5.5 * u, h - 4 * u, { size: 1.5 * u, color: "rgba(255,255,255,0.75)", max: half });
          text(ctx, settings.join("  "), w - 4 * u, h - 7.3 * u, { size: 2 * u, color: "#ffffff", weight: "600", align: "right", max: half });
          text(ctx, date, w - 4 * u, h - 4 * u, { size: 1.5 * u, color: "rgba(255,255,255,0.75)", family: MONO, align: "right", max: half });
        },
      };
    }
  }
}

/** Canvas size for `ratio` that holds a w×h block, plus where the block goes. */
export function fitRatio(w: number, h: number, ratio: FrameRatio): { W: number; H: number; x: number; y: number } {
  if (ratio === "auto") return { W: w, H: h, x: 0, y: 0 };
  const [a, b] = ratio.split(":").map(Number);
  const r = a / b;
  // A little air around the frame, so it doesn't touch the edges of the padded canvas.
  const margin = 1.06;
  let W = w * margin;
  let H = h * margin;
  if (W / H > r) H = W / r;
  else W = H * r;
  W = Math.round(W);
  H = Math.round(H);
  return { W, H, x: Math.round((W - w) / 2), y: Math.round((H - h) / 2) };
}

/** Render the framed photo; `photo` is any decodable image. */
export async function renderFrame(photo: Blob, info: FrameInfo, o: FrameOptions): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(photo);
  try {
    const block = layoutBlock(bmp, info, o);
    const { W, H, x, y } = fitRatio(block.w, block.h, o.ratio);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W);
    canvas.height = Math.round(H);
    const ctx = canvas.getContext("2d")!;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = block.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.translate(x, y);
    block.draw(ctx);
    return canvas;
  } finally {
    bmp.close();
  }
}

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.93));
}
