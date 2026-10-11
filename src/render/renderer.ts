import { BLENDER_COLORS, GRADING_RANGES, normalizeParams, type RecipeParams } from "../np3/recipe";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders";

/** An image ready for the GPU: a downscaled copy plus a heavily blurred one for clarity. */
export interface PreparedSource {
  key: string;
  image: HTMLCanvasElement;
  blur: HTMLCanvasElement;
  width: number;
  height: number;
}

const MAX_EDGE = 1600;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function prepareSource(key: string, img: CanvasImageSource & { width: number; height: number }): PreparedSource {
  const srcW = "naturalWidth" in img ? (img as HTMLImageElement).naturalWidth : img.width;
  const srcH = "naturalHeight" in img ? (img as HTMLImageElement).naturalHeight : img.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const image = makeCanvas(srcW * scale, srcH * scale);
  const ctx = image.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, image.width, image.height);

  // Blur by repeated halving; bilinear upsampling on the GPU smooths the rest.
  let blur = image;
  const target = Math.max(image.width, image.height) / 48;
  while (Math.max(blur.width, blur.height) / 2 >= target && blur.width > 8 && blur.height > 8) {
    const next = makeCanvas(blur.width / 2, blur.height / 2);
    const nctx = next.getContext("2d")!;
    nctx.imageSmoothingQuality = "high";
    nctx.drawImage(blur, 0, 0, next.width, next.height);
    blur = next;
  }
  return { key, image, blur, width: image.width, height: image.height };
}

/** OKLab a/b direction for an HSV-style hue (0 = red, 120 = green, 240 = blue). */
function hueDirection(hueDeg: number): [number, number] {
  const h = (((hueDeg % 360) + 360) % 360) / 60;
  const x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] =
    h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const len = Math.hypot(a, bb) || 1;
  return [a / len, bb / len];
}

interface GpuSource {
  tex: WebGLTexture;
  blurTex: WebGLTexture;
  width: number;
  height: number;
}

class Renderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private lutTex: WebGLTexture;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
  private sources = new Map<string, GpuSource>();
  private lost = false;

  constructor() {
    this.canvas = document.createElement("canvas");
    const gl = this.canvas.getContext("webgl2", { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error("webgl2-unavailable");
    this.gl = gl;
    this.canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
    });
    this.program = this.buildProgram();
    this.lutTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.program, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  get isLost() {
    return this.lost || this.gl.isContextLost();
  }

  private buildProgram(): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader error");
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link error");
    gl.useProgram(p);
    return p;
  }

  private u(name: string) {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    return this.uniforms.get(name)!;
  }

  private upload(canvas: HTMLCanvasElement): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  private gpuSource(src: PreparedSource): GpuSource {
    let g = this.sources.get(src.key);
    if (!g) {
      g = { tex: this.upload(src.image), blurTex: this.upload(src.blur), width: src.width, height: src.height };
      this.sources.set(src.key, g);
      if (this.sources.size > 24) {
        const [oldKey, old] = this.sources.entries().next().value!;
        this.gl.deleteTexture(old.tex);
        this.gl.deleteTexture(old.blurTex);
        this.sources.delete(oldKey);
      }
    }
    return g;
  }

  forget(key: string) {
    const g = this.sources.get(key);
    if (!g) return;
    this.gl.deleteTexture(g.tex);
    this.gl.deleteTexture(g.blurTex);
    this.sources.delete(key);
  }

  /** Render into the internal canvas at the given size and return it. */
  render(src: PreparedSource, params: RecipeParams | null, width: number, height: number): HTMLCanvasElement {
    const gl = this.gl;
    const p = normalizeParams(params ?? {});
    const identity = params === null;
    this.canvas.width = width;
    this.canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);

    const g = this.gpuSource(src);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.tex);
    gl.uniform1i(this.u("u_src"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, g.blurTex);
    gl.uniform1i(this.u("u_blur"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.uniform1i(this.u("u_lut"), 2);

    const useCurve = !identity && !!p.toneCurve;
    if (useCurve) {
      const lut = new Float32Array(p.toneCurve!.raw.map((v) => v / 32767));
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 257, 1, 0, gl.RED, gl.FLOAT, lut);
    }
    gl.uniform1i(this.u("u_useCurve"), useCurve ? 1 : 0);
    // Texel size of the displayed image, so sharpening scales with the preview size.
    gl.uniform2f(this.u("u_texel"), 1 / width, 1 / height);

    // The default picture control already has some sharpening/clarity; preview only the deviation.
    const k = identity ? 0 : 1;
    gl.uniform1f(this.u("u_sharp"), (k * ((p.sharpning ?? 2) - 2)) / 9);
    gl.uniform1f(this.u("u_midSharp"), (k * ((p.midRangeSharpning ?? 1) - 1)) / 5);
    gl.uniform1f(this.u("u_clarity"), (k * ((p.clarity ?? 0.5) - 0.5)) / 5);
    gl.uniform1f(this.u("u_contrast"), (k * (p.contrast ?? 0)) / 100);
    gl.uniform1f(this.u("u_highlights"), (k * (p.highlights ?? 0)) / 100);
    gl.uniform1f(this.u("u_shadows"), (k * (p.shadows ?? 0)) / 100);
    gl.uniform1f(this.u("u_whites"), (k * (p.whiteLevel ?? 0)) / 100);
    gl.uniform1f(this.u("u_blacks"), (k * (p.blackLevel ?? 0)) / 100);
    gl.uniform1f(this.u("u_saturation"), (k * (p.saturation ?? 0)) / 100);

    const blender = new Float32Array(24);
    BLENDER_COLORS.forEach((c, i) => {
      const v = p.colorBlender?.[c];
      blender[i * 3] = (k * (v?.hue ?? 0)) / 100;
      blender[i * 3 + 1] = (k * (v?.chroma ?? 0)) / 100;
      blender[i * 3 + 2] = (k * (v?.brightness ?? 0)) / 100;
    });
    gl.uniform3fv(this.u("u_blender"), blender);

    const grade = new Float32Array(9);
    const dirs = new Float32Array(6);
    GRADING_RANGES.forEach((r, i) => {
      const v = p.colorGrading?.[r];
      grade[i * 3] = v?.hue ?? 0;
      grade[i * 3 + 1] = (k * (v?.chroma ?? 0)) / 100;
      grade[i * 3 + 2] = (k * (v?.brightness ?? 0)) / 100;
      const [a, b] = hueDirection(v?.hue ?? 0);
      dirs[i * 2] = a;
      dirs[i * 2 + 1] = b;
    });
    gl.uniform3fv(this.u("u_grade"), grade);
    gl.uniform2fv(this.u("u_gradeDir"), dirs);
    gl.uniform1f(this.u("u_blending"), (p.colorGrading?.blending ?? 50) / 100);
    gl.uniform1f(this.u("u_balance"), (p.colorGrading?.balance ?? 0) / 100);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return this.canvas;
  }
}

let instance: Renderer | null = null;
let unavailable = false;

export function getRenderer(): Renderer | null {
  if (unavailable) return null;
  if (instance && !instance.isLost) return instance;
  try {
    instance = new Renderer();
  } catch (err) {
    console.warn("[NP3 Lab] WebGL2 renderer unavailable", err);
    unavailable = true;
    instance = null;
  }
  return instance;
}

/** Fit an image of w×h inside maxW×maxH, preserving aspect ratio. */
export function fitSize(w: number, h: number, maxW: number, maxH = Infinity): { width: number; height: number } {
  const scale = Math.min(maxW / w, maxH / h, 1);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * Draw `src` processed with `params` into a visible 2D canvas. Pass `null` params
 * for the untouched "before" image. Falls back to the original when WebGL2 is missing.
 */
export function drawInto(target: HTMLCanvasElement, src: PreparedSource, params: RecipeParams | null, maxW: number, maxH?: number) {
  const { width, height } = fitSize(src.width, src.height, maxW, maxH);
  if (target.width !== width) target.width = width;
  if (target.height !== height) target.height = height;
  const ctx = target.getContext("2d")!;
  const renderer = params ? getRenderer() : null;
  if (renderer) {
    ctx.drawImage(renderer.render(src, params, width, height), 0, 0);
  } else {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src.image, 0, 0, width, height);
  }
}

const thumbCache = new Map<string, string>();

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** Render a small JPEG thumbnail and cache it as an object URL. */
export async function renderThumbnail(src: PreparedSource, params: RecipeParams | null, maxW: number): Promise<string> {
  const key = `${src.key}|${maxW}|${hash(JSON.stringify(params))}`;
  const cached = thumbCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  drawInto(canvas, src, params, maxW);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  const url = blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/jpeg", 0.85);
  thumbCache.set(key, url);
  return url;
}

/** Free everything kept for an image that's gone (a deleted preview scene). */
export function forgetSource(key: string) {
  instance?.forget(key);
  for (const [k, url] of thumbCache)
    if (k.startsWith(`${key}|`)) {
      URL.revokeObjectURL(url);
      thumbCache.delete(k);
    }
}

export function webglAvailable(): boolean {
  return getRenderer() !== null;
}
