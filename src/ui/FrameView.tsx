import { useEffect, useRef, useState } from "preact/hooks";
import {
  CROP_RATIOS,
  DEFAULT_FRAME,
  MAX_CROP_ZOOM,
  NO_CROP,
  cropRect,
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
 * The photo with the crop box over it: drag the box to move it, the slider to zoom in.
 * Changes are reported when a drag or slide ends, so the frame isn't redrawn on every move.
 */
function CropEditor({ src, crop, onChange }: { src: string; crop: Crop; onChange: (c: Crop) => void }) {
  const [draft, setDraft] = useState(crop);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  useEffect(() => setDraft(crop), [crop]);

  // Keep the centre where the box can actually be, so a drag past the edge doesn't build up.
  const settle = (c: Crop): Crop => {
    if (!size) return c;
    const r = cropRect(size.w, size.h, c);
    return { ...c, cx: (r.sx + r.sw / 2) / size.w, cy: (r.sy + r.sh / 2) / size.h };
  };
  const box = size && cropRect(size.w, size.h, draft);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  return (
    <div class="crop-editor">
      <div
        ref={wrap}
        class="crop-stage"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, cx: draft.cx, cy: draft.cy };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          const el = wrap.current;
          if (!d || !el) return;
          setDraft(settle({ ...draft, cx: d.cx + (e.clientX - d.x) / el.clientWidth, cy: d.cy + (e.clientY - d.y) / el.clientHeight }));
        }}
        onPointerUp={() => {
          if (!drag.current) return;
          drag.current = null;
          onChange(draft);
        }}
      >
        <img src={src} alt="" draggable={false} onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        {box && size && (
          <div class="crop-box" style={{ left: pct(box.sx, size.w), top: pct(box.sy, size.h), width: pct(box.sw, size.w), height: pct(box.sh, size.h) }} />
        )}
      </div>
      <label class="crop-zoom">
        <span>{t("frameCropZoom")}</span>
        <input
          type="range"
          min={1}
          max={MAX_CROP_ZOOM}
          step={0.01}
          value={draft.zoom}
          onInput={(e) => setDraft(settle({ ...draft, zoom: Number(e.currentTarget.value) }))}
          onChange={() => onChange(draft)}
        />
      </label>
      <p class="muted small">{t("frameCropHint")}</p>
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
  const set = (patch: Partial<FrameOptions>) =>
    setOpts((o) => {
      const next = { ...o, ...patch };
      writeStore("frameOptions", next);
      return next;
    });

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

  // iOS (and Safari/Chrome on phones): the share sheet saves to Photos or posts straight to an app.
  const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([], "x.jpg", { type: "image/jpeg" })] });
  const fileName = `${photo.name.replace(/\.[^.]+$/, "")}-${recipe?.npName ?? "frame"}.jpg`.replace(/[^\w.\-]+/g, "_");
  const toneFixed = FIXED_TONE.includes(opts.layout);

  return (
    <div class="lightbox frame-view">
      <div class="frame-preview">
        {cropping && fullUrl ? (
          <CropEditor src={fullUrl} crop={crop} onChange={setCrop} />
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
                {r === "none" ? t("frameCropNone") : r}
              </button>
            ))}
            {crop.ratio !== "none" && (
              <button class={`chip ghost${cropping ? " active" : ""}`} onClick={() => setCropping((c) => !c)}>
                {cropping ? `✓ ${t("frameCropDone")}` : t("frameCropAdjust")}
              </button>
            )}
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
        <button onClick={onBack}>{t("frameBack")}</button>
        {canShare && (
          <button disabled={!frame} onClick={() => frame && void navigator.share({ files: [new File([frame.blob], fileName, { type: "image/jpeg" })] }).catch(() => undefined)}>
            {t("frameShare")}
          </button>
        )}
        <button class="primary" disabled={!frame} onClick={() => frame && downloadBytes(frame.blob, fileName, "image/jpeg")}>
          {t("frameSave")}
        </button>
      </div>
    </div>
  );
}
