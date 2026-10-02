import { useEffect, useRef, useState } from "preact/hooks";
import { t } from "../i18n";
import { addPhotos, deletePhoto, fullPhotoUrl, photosByRecipe, type PhotoThumb } from "../photos";
import { showToast } from "../state";
import { PHOTO_ACCEPT } from "../raw";

function Lightbox({ photos, index, onClose, onIndex }: { photos: PhotoThumb[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
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
        <button onClick={onClose}>{t("close")}</button>
      </div>
    </div>
  );
}

/** "Photos taken with this recipe" — the user's own examples, added by hand or by drag & drop. */
export function RecipePhotos({ recipeId }: { recipeId: string }) {
  const photos = photosByRecipe.value[recipeId] ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    const n = await addPhotos(recipeId, files);
    setBusy(false);
    if (n > 0) showToast(t("photosAdded", { n }), "ok");
  };

  return (
    <section
      class={`recipe-photos${over ? " over" : ""}`}
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
        <div class="photo-grid">
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
