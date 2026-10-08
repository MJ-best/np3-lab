import { useEffect, useRef, useState } from "preact/hooks";
import { FRAME_THEMES, canvasToJpeg, renderFrame, type FrameTheme } from "../frame";
import { t, tx } from "../i18n";
import { downloadBytes } from "../pack/download";
import { deletePhoto, fullPhoto, fullPhotoUrl, photosByRecipe, type PhotoThumb } from "../photos";
import { recipeById } from "../state";
import { importPhotos } from "../photoImport";
import { PHOTO_ACCEPT } from "../raw";

export function Lightbox({ photos, index, onClose, onIndex }: { photos: PhotoThumb[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const photo = photos[index];
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    let current: string | null = null;
    void fullPhotoUrl(photo.id).then((u) => {
      current = u;
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
      if (current) URL.revokeObjectURL(current);
      setUrl(null);
    };
  }, [photo.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onClose();
      }
      if (e.key === "ArrowRight") onIndex((index + 1) % photos.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
    };
    // Capture phase so Escape closes the photo before the recipe dialog underneath.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, photos.length]);
  const [theme, setTheme] = useState<FrameTheme | null>(null);
  if (theme) return <FrameView photo={photo} theme={theme} onTheme={setTheme} onBack={() => setTheme(null)} />;
  return (
    <div class="lightbox" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <img src={url ?? photo.thumbUrl} alt={photo.name} />
      <div class="lightbox-bar">
        <span class="muted small">
          {index + 1} / {photos.length} · {photo.name}
        </span>
        <button
          class="danger ghost"
          onClick={async () => {
            await deletePhoto(photo.id);
            if (photos.length <= 1) onClose();
            else onIndex(Math.min(index, photos.length - 2));
          }}
        >
          {t("deletePhoto")}
        </button>
        <button class="primary" onClick={() => setTheme("strap")}>
          {t("frameBtn")}
        </button>
        <button onClick={onClose}>{t("close")}</button>
      </div>
    </div>
  );
}

const THEME_LABEL = { strap: "frameStrap", film: "frameFilm", gallery: "frameGallery" } as const;

/** The photo framed with its recipe name and shooting details, ready to save and share. */
function FrameView({ photo, theme, onTheme, onBack }: { photo: PhotoThumb; theme: FrameTheme; onTheme: (t: FrameTheme) => void; onBack: () => void }) {
  const recipe = recipeById.value.get(photo.recipeId);
  const [frame, setFrame] = useState<{ url: string; blob: Blob } | null>(null);
  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void (async () => {
      const full = await fullPhoto(photo.id);
      if (!full || !alive) return;
      const title = recipe ? tx(recipe.title) : "";
      const canvas = await renderFrame(full, { title, npName: recipe?.npName ?? title, exif: photo.exif }, theme);
      const blob = await canvasToJpeg(canvas);
      if (!alive) return;
      made = URL.createObjectURL(blob);
      setFrame({ url: made, blob });
    })();
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [photo.id, theme]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onBack();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  // iOS (and Safari/Chrome on phones): the share sheet saves to Photos or posts straight to an app.
  const canShare = typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([], "x.jpg", { type: "image/jpeg" })] });
  const fileName = `${photo.name.replace(/\.[^.]+$/, "")}-${recipe?.npName ?? "frame"}.jpg`.replace(/[^\w.\-]+/g, "_");
  return (
    <div class="lightbox frame-view">
      <div class="segmented frame-themes" role="radiogroup">
        {FRAME_THEMES.map((th) => (
          <button key={th} role="radio" aria-checked={th === theme} class={th === theme ? "active" : ""} onClick={() => onTheme(th)}>
            {t(THEME_LABEL[th])}
          </button>
        ))}
      </div>
      {frame ? <img src={frame.url} alt={photo.name} /> : <div class="frame-loading">…</div>}
      {!photo.exif && <p class="muted small frame-note">{t("frameNoExif")}</p>}
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

/**
 * "Photos taken with this recipe" — the user's own examples, added by hand or by drag & drop.
 * `wall` is the full gallery (photos keep their shape, portrait or landscape); `compact`
 * is the invitation shown under the preview while a recipe has no photos yet.
 */
export function RecipePhotos({ recipeId, layout = "compact" }: { recipeId: string; layout?: "wall" | "compact" }) {
  const photos = photosByRecipe.value[recipeId] ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    // Each photo goes to the recipe it was shot with; ones without that info stay here.
    await importPhotos(files, { into: recipeId });
    setBusy(false);
  };

  return (
    <section
      class={`recipe-photos ${layout}${over ? " over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        // Handled here so the window-level drop doesn't also treat them as preview scenes.
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        void add(Array.from(e.dataTransfer?.files ?? []));
      }}
    >
      <div class="recipe-photos-head">
        <h3>
          {t("myPhotosTitle")} {photos.length > 0 && <span class="count">{photos.length}</span>}
        </h3>
        <button class="small-btn" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "…" : `＋ ${t("addPhotos")}`}
        </button>
        <input
          ref={input}
          type="file"
          accept={PHOTO_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const el = e.currentTarget;
            void add(Array.from(el.files ?? []));
            el.value = "";
          }}
        />
      </div>
      {photos.length === 0 ? (
        <p class="hint">{t("myPhotosEmpty")}</p>
      ) : (
        <div class={layout === "wall" ? "photo-wall" : "photo-grid"}>
          {photos.map((p, i) => (
            <button key={p.id} class="photo-tile" onClick={() => setOpen(i)} aria-label={p.name}>
              <img src={p.thumbUrl} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}
      {open !== null && photos[open] && <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
    </section>
  );
}
