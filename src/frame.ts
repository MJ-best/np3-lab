import { cameraName, dateText, settingsParts, type PhotoExif } from "./exif";

/*
 * Frames for sharing a photo: the picture with its recipe name and shooting details
 * set around it. Drawn on a canvas at the photo's own resolution.
 */

export type FrameTheme = "strap" | "film" | "gallery";
export const FRAME_THEMES: FrameTheme[] = ["strap", "film", "gallery"];

export interface FrameInfo {
  /** The recipe's name as shown in the app. */
  title: string;
  /** The name the camera shows (NP3, ASCII). */
  npName: string;
  exif?: PhotoExif;
}

const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", "Pretendard", "Hiragino Sans", "Segoe UI", "Malgun Gothic", Roboto, sans-serif';
const SERIF = '"New York", Georgia, "Times New Roman", "Apple SD Gothic Neo", "Noto Serif", serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Roboto Mono", monospace';
const NIKON_YELLOW = "#ffe100";

/** Shrink `size` until `text` fits in `maxWidth`; returns the font string used. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, family: string, weight = "400", style = ""): string {
  let s = size;
  const font = () => `${style} ${weight} ${s}px ${family}`.trim();
  ctx.font = font();
  while (s > 8 && ctx.measureText(text).width > maxWidth) {
    s *= 0.94;
    ctx.font = font();
  }
  return font();
}

function draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, align: CanvasTextAlign, color: string, maxWidth: number, size: number, family: string, weight?: string, style?: string) {
  if (!text) return;
  ctx.font = fit(ctx, text, maxWidth, size, family, weight, style);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

/** Render the framed photo; `photo` is any decodable image. */
export async function renderFrame(photo: Blob, info: FrameInfo, theme: FrameTheme): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(photo);
  const w = bmp.width;
  const h = bmp.height;
  // One unit = 1% of the photo's average side, so portrait and landscape frames look alike.
  const u = (w + h) / 200;
  const e = info.exif ?? {};
  const camera = cameraName(e) ?? "";
  const settings = settingsParts(e);
  const date = dateText(e) ?? "";

  const pad = theme === "strap" ? { side: 0, top: 0, bottom: 11 * u } : theme === "film" ? { side: 3 * u, top: 3 * u, bottom: 10 * u } : { side: 6 * u, top: 6 * u, bottom: 20 * u };
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w + pad.side * 2);
  canvas.height = Math.round(h + pad.top + pad.bottom);
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme === "film" ? "#0b0b0b" : "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, pad.side, pad.top);
  bmp.close();

  const W = canvas.width;
  const barTop = pad.top + h;
  const half = (W - 2 * pad.side) / 2 - 4 * u;

  if (theme === "strap") {
    // Recipe and camera on the left, settings on the right; a small Nikon-yellow mark leads the recipe name.
    const left = 4 * u;
    const right = W - 4 * u;
    // Without shooting details the name sits alone, centred in the bar.
    const line1 = camera || settings.length ? barTop + 5 * u : barTop + 6.3 * u;
    const line2 = barTop + 8.2 * u;
    ctx.fillStyle = NIKON_YELLOW;
    ctx.fillRect(left, line1 - 2.1 * u, 0.6 * u, 2.4 * u);
    draw(ctx, info.title, left + 1.5 * u, line1, "left", "#111", half - 1.5 * u, 2.4 * u, SANS, "700");
    draw(ctx, camera, left + 1.5 * u, line2, "left", "#8a8a8a", half - 1.5 * u, 1.7 * u, SANS, "500");
    draw(ctx, settings.join("   "), right, line1, "right", "#222", half, 2.1 * u, SANS, "600");
    draw(ctx, [e.lens, date].filter(Boolean).join("  ·  "), right, line2, "right", "#8a8a8a", half, 1.6 * u, SANS, "400");
  } else if (theme === "film") {
    // Film-edge lettering: the name the camera shows, in warm amber.
    const amber = "#f2a33a";
    const y1 = barTop + 4.6 * u;
    const y2 = barTop + 7.6 * u;
    const left = pad.side;
    const right = W - pad.side;
    draw(ctx, `▸ ${info.npName.toUpperCase()}`, left, y1, "left", amber, half, 2.3 * u, MONO, "600");
    draw(ctx, settings.join("  "), right, y1, "right", "#e9e4da", half, 1.9 * u, MONO, "500");
    draw(ctx, info.title !== info.npName ? info.title : camera, left, y2, "left", "#9a9488", half, 1.6 * u, SANS, "500");
    draw(ctx, [info.title !== info.npName ? camera : "", date].filter(Boolean).join("  ·  "), right, y2, "right", "#9a9488", half, 1.6 * u, MONO, "400");
  } else {
    // Gallery print: the recipe name centred in italic serif, details in one quiet line beneath.
    const cx = W / 2;
    const max = W - 2 * pad.side;
    draw(ctx, info.title, cx, barTop + 9.5 * u, "center", "#151515", max, 3.4 * u, SERIF, "400", "italic");
    ctx.fillStyle = NIKON_YELLOW;
    ctx.fillRect(cx - 2 * u, barTop + 11.6 * u, 4 * u, 0.3 * u);
    draw(ctx, [camera, settings.join("  "), date].filter(Boolean).join("   ·   "), cx, barTop + 14.8 * u, "center", "#7d7d7d", max, 1.6 * u, SANS, "500");
  }
  return canvas;
}

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.93));
}
