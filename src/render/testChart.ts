/*
 * Procedurally drawn stand-in scenes, used until real sample photos are placed
 * in /samples. They exercise the parts of a recipe people care about: skin
 * tones, foliage and sky, neon at night, and a colour chart.
 */

const W = 1500;
const H = 1000;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  return [c, c.getContext("2d")!];
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grain(ctx: CanvasRenderingContext2D, amount: number, seed: number) {
  const img = ctx.getImageData(0, 0, W, H);
  const r = rng(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * amount;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// Approximate sRGB values of the classic 24-patch colour checker.
const CHECKER = [
  "#735244", "#c29682", "#627a9d", "#576c43", "#8580b1", "#67bdaa",
  "#d67e2c", "#505ba6", "#c15a63", "#5e3c6c", "#9dbc40", "#e0a32e",
  "#383d96", "#469449", "#af363c", "#e7c71f", "#bb5695", "#0885a1",
  "#f3f3f2", "#c8c8c8", "#a0a0a0", "#7a7a79", "#555555", "#343434",
];

export function drawColorChart(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(0, 0, W, H);
  const pw = 200;
  const ph = 150;
  const gap = 22;
  const x0 = (W - (6 * pw + 5 * gap)) / 2;
  const y0 = 60;
  CHECKER.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(x0 + (i % 6) * (pw + gap), y0 + Math.floor(i / 6) * (ph + gap), pw, ph);
  });
  const yRamp = y0 + 4 * (ph + gap) + 20;
  const ramp = ctx.createLinearGradient(x0, 0, W - x0, 0);
  ramp.addColorStop(0, "#000");
  ramp.addColorStop(1, "#fff");
  ctx.fillStyle = ramp;
  ctx.fillRect(x0, yRamp, W - 2 * x0, 90);
  const yHue = yRamp + 110;
  for (let x = 0; x < W - 2 * x0; x++) {
    const hue = (x / (W - 2 * x0)) * 360;
    const g = ctx.createLinearGradient(0, yHue, 0, yHue + 110);
    g.addColorStop(0, `hsl(${hue} 100% 85%)`);
    g.addColorStop(0.5, `hsl(${hue} 100% 50%)`);
    g.addColorStop(1, `hsl(${hue} 100% 15%)`);
    ctx.fillStyle = g;
    ctx.fillRect(x0 + x, yHue, 1, 110);
  }
  return c;
}

export function drawLandscape(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const r = rng(7);
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  sky.addColorStop(0, "#2f6fb4");
  sky.addColorStop(0.6, "#8fbde3");
  sky.addColorStop(1, "#f1d9b0");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W * 0.75, H * 0.36, 10, W * 0.75, H * 0.36, 260);
  sun.addColorStop(0, "rgba(255,244,214,1)");
  sun.addColorStop(0.2, "rgba(255,221,160,0.7)");
  sun.addColorStop(1, "rgba(255,200,140,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(r() * W, 60 + r() * 220, 120 + r() * 160, 18 + r() * 26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const ridge = (base: number, amp: number, color: string, seed: number) => {
    const rr = rng(seed);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    let y = base;
    for (let x = 0; x <= W; x += 20) {
      y += (rr() - 0.5) * amp;
      y = Math.max(base - amp * 3, Math.min(base + amp * 2, y));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.fill();
  };
  ridge(H * 0.5, 28, "#6d86a3", 11);
  ridge(H * 0.58, 22, "#4f6f58", 12);
  ridge(H * 0.66, 16, "#3f7a36", 13);
  const water = ctx.createLinearGradient(0, H * 0.74, 0, H);
  water.addColorStop(0, "#9cc3dc");
  water.addColorStop(1, "#2c5877");
  ctx.fillStyle = water;
  ctx.fillRect(0, H * 0.74, W, H * 0.26);
  for (let i = 0; i < 900; i++) {
    const x = r() * W;
    const y = H * 0.62 + r() * H * 0.12;
    ctx.fillStyle = `hsl(${80 + r() * 50} ${45 + r() * 30}% ${18 + r() * 28}%)`;
    ctx.beginPath();
    ctx.arc(x, y, 3 + r() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 120; i++) {
    const hue = [0, 8, 45, 52, 300][Math.floor(r() * 5)];
    ctx.fillStyle = `hsl(${hue} 85% ${50 + r() * 15}%)`;
    ctx.beginPath();
    ctx.arc(r() * W, H * 0.7 + r() * H * 0.04, 3 + r() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let i = 0; i < 60; i++) ctx.fillRect(r() * W, H * 0.76 + r() * H * 0.22, 30 + r() * 90, 2);
  grain(ctx, 10, 3);
  return c;
}

export function drawSkinTones(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#4a3d33");
  bg.addColorStop(0.55, "#8f7a66");
  bg.addColorStop(1, "#cbb8a2");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Soft window light from the top left.
  const light = ctx.createRadialGradient(W * 0.15, H * 0.1, 20, W * 0.15, H * 0.1, W * 0.7);
  light.addColorStop(0, "rgba(255,236,210,0.35)");
  light.addColorStop(1, "rgba(255,236,210,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);
  const tones = ["#f6d7c3", "#eec1a2", "#e0a98a", "#c68863", "#a8704f", "#8a5a3c", "#6b4430", "#4b3024"];
  tones.forEach((tone, i) => {
    const cx = 190 + (i % 4) * 375;
    const cy = 250 + Math.floor(i / 4) * 420;
    // Shaded sphere: specular highlight, mid tone, core shadow — how skin reads under one light.
    const g = ctx.createRadialGradient(cx - 55, cy - 60, 8, cx, cy, 165);
    g.addColorStop(0, "#fff4ec");
    g.addColorStop(0.16, tone);
    g.addColorStop(0.72, tone);
    g.addColorStop(1, "#24160f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tone;
    ctx.fillRect(cx - 150, cy + 175, 300, 34);
  });
  grain(ctx, 8, 5);
  return c;
}

export function drawNight(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const r = rng(99);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#060914");
  sky.addColorStop(0.6, "#141a2e");
  sky.addColorStop(1, "#0a0a0f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) {
    const x = i * 170 + r() * 40;
    const h = 250 + r() * 420;
    ctx.fillStyle = `hsl(${220 + r() * 30} 20% ${8 + r() * 8}%)`;
    ctx.fillRect(x, H * 0.72 - h, 150, h);
    for (let wy = H * 0.72 - h + 20; wy < H * 0.72 - 20; wy += 34) {
      for (let wx = x + 14; wx < x + 140; wx += 30) {
        if (r() < 0.45) {
          ctx.fillStyle = r() < 0.7 ? "hsl(40 90% 65%)" : "hsl(190 60% 70%)";
          ctx.fillRect(wx, wy, 14, 18);
        }
      }
    }
  }
  const neon = (x: number, y: number, w: number, h: number, hue: number) => {
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 5, x + w / 2, y + h / 2, w);
    g.addColorStop(0, `hsla(${hue} 100% 60% / 0.5)`);
    g.addColorStop(1, `hsla(${hue} 100% 50% / 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - w, y - w, w * 3, h + w * 2);
    ctx.fillStyle = `hsl(${hue} 100% 70%)`;
    ctx.fillRect(x, y, w, h);
  };
  neon(180, 380, 220, 40, 320);
  neon(620, 300, 60, 260, 185);
  neon(900, 450, 260, 36, 25);
  neon(1250, 360, 140, 34, 280);
  ctx.fillStyle = "#08080c";
  ctx.fillRect(0, H * 0.72, W, H * 0.28);
  for (let i = 0; i < 40; i++) {
    const x = r() * W;
    const hue = [320, 185, 25, 280, 45][Math.floor(r() * 5)];
    ctx.fillStyle = `hsla(${hue} 90% 60% / ${0.08 + r() * 0.15})`;
    ctx.fillRect(x, H * 0.74, 4 + r() * 30, H * 0.26);
  }
  for (let i = 0; i < 30; i++) {
    const x = r() * W;
    const y = H * 0.5 + r() * H * 0.3;
    const rad = 10 + r() * 36;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, "hsla(40 100% 75% / 0.8)");
    g.addColorStop(1, "hsla(40 100% 60% / 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  grain(ctx, 14, 9);
  return c;
}
