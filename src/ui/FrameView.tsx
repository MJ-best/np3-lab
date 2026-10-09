import { useEffect, useRef, useState } from "preact/hooks";
import {
  CROP_RATIOS,
  DEFAULT_FRAME,
  MAX_CROP_ANGLE,
  MAX_CROP_ZOOM,
  NO_CROP,
  cropWindow,
  FIXED_TONE,
  FRAME_LAYOUTS,
  FRAME_RATIOS,
  FRAME_TONES,
  canvasToJpeg,
  renderFrame,
  type Crop,
  type FrameInfo,
  type FrameOptions,
} from "../frame";
import { t, tx, type MessageKey } from "../i18n";
import { BLENDER_COLORS, GRADING_RANGES, RANGES, SCALAR_KEYS, TONE_KEYS, type Recipe } from "../np3/recipe";
import { downloadBytes } from "../pack/download";
import { fullPhoto, fullPhotoUrl, type PhotoThumb } from "../photos";
import { recipeById } from "../state";
import { readStore, writeStore } from "../storage";
import { BAND_HUES } from "./ColorPanels";
import { formatValue } from "./Slider";

const LAYOUT_LABEL: Record<FrameOptions["layout"], MessageKey> = {
  strap: "frameStrap",
  brand: "frameBrand",
  shotOn: "frameShotOn",
  centered: "frameCentered",
  oneLine: "frameOneLine",
  monitor: "frameMonitor",
  polaroid: "framePolaroid",
  gallery: "frameGallery",
  minimal: "frameMinimal",
  poster: "framePoster",
  recipe: "frameRecipe",
  film: "frameFilm",
  cinema: "frameCinema",
  overlay: "frameOverlay",
};
const TONE_LABEL: Record<FrameOptions["tone"], MessageKey> = { light: "frameToneLight", cream: "frameToneCream", dark: "frameToneDark" };
const SHOW: [keyof FrameOptions & `show${string}`, MessageKey][] = [
  ["showSettings", "frameShowSettings"],
  ["showGear", "frameShowGear"],
  ["showDate", "frameShowDate"],
];

/** What the recipe card lists: the settings that differ from neutral, and the colours it moves. */
function recipeDetails(recipe: Recipe | undefined): Pick<FrameInfo, "params" | "swatches"> {
  const p = recipe?.params;
  if (!p) return {};
  const params: [string, string][] = [];
  for (const k of SCALAR_KEYS) {
    if (p.toneCurve && (TONE_KEYS as readonly string[]).includes(k)) continue;
    const v = p[k] ?? RANGES[k].def;
    if (Math.abs(v - RANGES[k].def) > 1e-9) params.push([t(k), formatValue(v, RANGES[k].step)]);
  }
  if (p.toneCurve) params.push([t("toneCurve"), "〰"]);
  const swatches = [
    ...BLENDER_COLORS.filter((c) => p.colorBlender?.[c]).map((c) => `hsl(${BAND_HUES[c]} 80% 52%)`),
    ...GRADING_RANGES.filter((r) => p.colorGrading?.[r]).map((r) => `hsl(${p.colorGrading![r]!.hue ?? 0} 70% 55%)`),
  ];
  return { params, swatches };
}

/**
 * The crop window stays put and the photo moves under it, as in phone photo editors: drag with
 * one finger, pinch to zoom and turn with two (or the mouse wheel and the angle slider). The new
 * crop is reported when a gesture ends, so the frame isn't redrawn on every move.
 */
function CropEditor({ src, crop, onChange, onDone }: { src: string; crop: Crop; onChange: (c: Crop) => void; onDone: () => void }) {
  const [draft, setDraft] = useState(crop);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [stageW, setStageW] = useState(0);
  const [grid, setGrid] = useState(() => readStore<boolean>("cropGrid") ?? true);
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ crop: Crop; pts: { x: number; y: number }[] } | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>();
  // The newest crop, ahead of the next render, so a gesture that ends right away reports it.
  const latest = useRef(draft);
  const update = (c: Crop) => {
    latest.current = c;
    setDraft(c);
  };
  useEffect(() => update(crop), [crop]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep zoom, angle and centre where the window still fits inside the photo.
  const settle = (c: Crop): Crop => {
    if (!size) return c;
    const win = cropWindow(size.w, size.h, c);
    return { ...c, zoom: Math.min(MAX_CROP_ZOOM, Math.max(1, c.zoom)), angle: win.angle, cx: win.cx, cy: win.cy };
  };
  const win = size && cropWindow(size.w, size.h, draft);
  const shape = win ? win.sw / win.sh : 1;
  const scale = win && stageW ? stageW / win.sw : 0;

  // Restart the gesture from where things are now whenever a finger is added or lifted.
  const restart = () => {
    gesture.current = { crop: latest.current, pts: [...pointers.current.values()] };
  };
  const move = () => {
    const g = gesture.current;
    if (!g || !size || !scale) return;
    const now = [...pointers.current.values()];
    if (now.length !== g.pts.length || now.length === 0) return;
    let next = { ...g.crop };
    const mid = (pts: { x: number; y: number }[]) => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });
    if (now.length >= 2) {
      const [a0, b0] = g.pts;
      const [a1, b1] = now;
      next.zoom = g.crop.zoom * (Math.hypot(b1.x - a1.x, b1.y - a1.y) / Math.max(1, Math.hypot(b0.x - a0.x, b0.y - a0.y)));
      const turn = Math.atan2(b1.y - a1.y, b1.x - a1.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x);
      next.angle = g.crop.angle + (turn * 180) / Math.PI;
    }
    // The photo follows the fingers: the window's centre moves the other way, in photo pixels.
    const m0 = mid(g.pts);
    const m1 = mid(now);
    const startWin = cropWindow(size.w, size.h, g.crop);
    const p = stageW / startWin.sw;
    const rad = (next.angle * Math.PI) / 180;
    const dx = (m1.x - m0.x) / p;
    const dy = (m1.y - m0.y) / p;
    next.cx = g.crop.cx - (Math.cos(rad) * dx + Math.sin(rad) * dy) / size.w;
    next.cy = g.crop.cy - (-Math.sin(rad) * dx + Math.cos(rad) * dy) / size.h;
    // A nearly straight photo snaps straight.
    if (Math.abs(next.angle) < 1) next.angle = 0;
    update(settle(next));
  };

  return (
    <div class="crop-editor">
      <div
        ref={stage}
        class="crop-stage"
        style={{ aspectRatio: String(shape), width: `min(100%, calc(52vh * ${shape}))` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          restart();
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          move();
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          restart();
          if (pointers.current.size === 0) onChange(latest.current);
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          restart();
          if (pointers.current.size === 0) onChange(latest.current);
        }}
        onWheel={(e) => {
          e.preventDefault();
          update(settle({ ...latest.current, zoom: latest.current.zoom * Math.exp(-e.deltaY * 0.0025) }));
          clearTimeout(wheelTimer.current);
          wheelTimer.current = setTimeout(() => onChange(latest.current), 250);
        }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={
            win && size && scale
              ? {
                  width: `${size.w}px`,
                  height: `${size.h}px`,
                  transform: `translate(${stageW / 2}px, ${(stageW / shape) / 2}px) rotate(${win.angle}deg) scale(${scale}) translate(${-win.cx * size.w}px, ${-win.cy * size.h}px)`,
                }
              : { opacity: 0 }
          }
        />
        {grid && <div class="crop-grid" />}
      </div>
      <label class="crop-zoom">
        <span>{t("frameCropAngle")}</span>
        <input
          type="range"
          min={-MAX_CROP_ANGLE}
          max={MAX_CROP_ANGLE}
          step={0.1}
          value={draft.angle}
          onInput={(e) => update(settle({ ...latest.current, angle: Number(e.currentTarget.value) }))}
          onChange={() => onChange(latest.current)}
        />
        <span class="mono">{draft.angle.toFixed(1)}°</span>
      </label>
      <div class="crop-foot">
        <button
          class={`chip${grid ? " active" : ""}`}
          aria-pressed={grid}
          onClick={() => {
            writeStore("cropGrid", !grid);
            setGrid(!grid);
          }}
        >
          # {t("frameCropGrid")}
        </button>
        <p class="muted small">{t("frameCropHint")}</p>
        <button class="primary" onClick={onDone}>
          ✓ {t("frameCropDone")}
        </button>
      </div>
    </div>
  );
}

/** The photo framed with its recipe name and shooting details, ready to save and share. */
export function FrameView({ photo, onBack }: { photo: PhotoThumb; onBack: () => void }) {
  const recipe = recipeById.value.get(photo.recipeId);
  const [opts, setOpts] = useState<FrameOptions>(() => ({ ...DEFAULT_FRAME, ...readStore<Partial<FrameOptions>>("frameOptions") }));
  const [frame, setFrame] = useState<{ url: string; blob: Blob } | null>(null);
  // The crop belongs to this photo, so it starts fresh each time and isn't remembered.
  const [crop, setCrop] = useState<Crop>(NO_CROP);
  const [cropping, setCropping] = useState(false);
  const croppingNow = useRef(cropping);
  croppingNow.current = cropping;
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  useEffect(() => {
    let made: string | null = null;
    void fullPhotoUrl(photo.id).then((u) => setFullUrl((made = u)));
    return () => {
      if (made) URL.revokeObjectURL(made);
    };
  }, [photo.id]);
  const set = (patch: Partial<FrameOptions>) => {
    // Any other choice goes back to the framed preview, so its effect is visible.
    setCropping(false);
    setOpts((o) => {
      const next = { ...o, ...patch };
      writeStore("frameOptions", next);
      return next;
    });
  };

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void (async () => {
      const full = await fullPhoto(photo.id);
      if (!full || !alive) return;
      const title = recipe ? tx(recipe.title) : "";
      const canvas = await renderFrame(full, { title, npName: recipe?.npName ?? title, exif: photo.exif, ...recipeDetails(recipe) }, opts, crop);
      const blob = await canvasToJpeg(canvas);
      if (!alive) return;
      made = URL.createObjectURL(blob);
      setFrame({ url: made, blob });
    })();
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [photo.id, opts, crop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      // First Escape leaves the crop box, the next one the frame.
      if (croppingNow.current) setCropping(false);
      else onBack();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  // On phones Save opens the share sheet (Save Image puts it in Photos, or post it straight to an
  // app); elsewhere it's a normal download or "Save as".
  const shareToSave =
    matchMedia("(pointer: coarse)").matches &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [new File([], "x.jpg", { type: "image/jpeg" })] });
  const save = (blob: Blob) => {
    if (!shareToSave) return downloadBytes(blob, fileName, "image/jpeg");
    void navigator.share({ files: [new File([blob], fileName, { type: "image/jpeg" })] }).catch((err: unknown) => {
      // Closing the sheet is a choice, not a failure; anything else falls back to a download.
      if ((err as Error)?.name !== "AbortError") downloadBytes(blob, fileName, "image/jpeg");
    });
  };
  const fileName = `${photo.name.replace(/\.[^.]+$/, "")}-${recipe?.npName ?? "frame"}.jpg`.replace(/[^\w.\-]+/g, "_");
  const toneFixed = FIXED_TONE.includes(opts.layout);

  return (
    <div class="lightbox frame-view">
      <div class="frame-preview">
        {cropping && fullUrl ? (
          <CropEditor src={fullUrl} crop={crop} onChange={setCrop} onDone={() => setCropping(false)} />
        ) : frame ? (
          <img src={frame.url} alt={photo.name} />
        ) : (
          <div class="frame-loading">…</div>
        )}
      </div>
      {!photo.exif && <p class="muted small frame-note">{t("frameNoExif")}</p>}
      <div class="frame-controls">
        <div class="frame-row">
          <span class="frame-label">{t("frameCrop")}</span>
          <div class="chips frame-chips" role="radiogroup" aria-label={t("frameCrop")}>
            {crop.ratio !== "none" && !cropping && (
              <button class="chip ghost" onClick={() => setCropping(true)}>
                {t("frameCropAdjust")}
              </button>
            )}
            {CROP_RATIOS.map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={r === crop.ratio}
                class={`chip${r === crop.ratio ? " active" : ""}`}
                onClick={() => {
                  // A new shape starts centred and fully zoomed out.
                  setCrop({ ...NO_CROP, ratio: r });
                  setCropping(r !== "none");
                }}
              >
                {r === "none" ? t("frameCropNone") : r === "original" ? t("frameCropOriginal") : r}
              </button>
            ))}
          </div>
        </div>
        <div class="frame-row">
          <span class="frame-label">{t("frameLayout")}</span>
          <div class="chips frame-chips" role="radiogroup" aria-label={t("frameLayout")}>
            {FRAME_LAYOUTS.map((l) => (
              <button key={l} role="radio" aria-checked={l === opts.layout} class={`chip${l === opts.layout ? " active" : ""}`} onClick={() => set({ layout: l })}>
                {t(LAYOUT_LABEL[l])}
              </button>
            ))}
          </div>
        </div>
        <div class="frame-row">
          <span class="frame-label">{t("frameTone")}</span>
          <div class="chips" role="radiogroup" aria-label={t("frameTone")}>
            {FRAME_TONES.map((tone) => (
              <button
                key={tone}
                role="radio"
                aria-checked={tone === opts.tone}
                disabled={toneFixed}
                class={`chip${tone === opts.tone && !toneFixed ? " active" : ""}`}
                onClick={() => set({ tone })}
              >
                <span class={`tone-dot ${tone}`} /> {t(TONE_LABEL[tone])}
              </button>
            ))}
          </div>
        </div>
        <div class="frame-row">
          <span class="frame-label">{t("frameRatio")}</span>
          <div class="chips" role="radiogroup" aria-label={t("frameRatio")}>
            {FRAME_RATIOS.map((r) => (
              <button key={r} role="radio" aria-checked={r === opts.ratio} class={`chip${r === opts.ratio ? " active" : ""}`} onClick={() => set({ ratio: r })}>
                {r === "auto" ? t("frameRatioAuto") : r}
              </button>
            ))}
          </div>
        </div>
        <div class="frame-row">
          <span class="frame-label">{t("frameShow")}</span>
          <div class="chips">
            {SHOW.map(([k, label]) => (
              <button key={k} aria-pressed={opts[k]} class={`chip${opts[k] ? " active" : ""}`} onClick={() => set({ [k]: !opts[k] })}>
                {t(label)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div class="lightbox-bar">
        <button onClick={onBack}>← {t("frameBack")}</button>
        <button class="primary" disabled={!frame} onClick={() => frame && save(frame.blob)}>
          {t("frameSave")}
        </button>
      </div>
    </div>
  );
}
