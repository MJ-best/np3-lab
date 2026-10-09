import { useRef, useState } from "preact/hooks";
import { t } from "../i18n";
import { importPhotos } from "../photoImport";
import { photosByRecipe } from "../photos";
import { PHOTO_ACCEPT } from "../raw";
import { allRecipes, showToast } from "../state";
import { PhotoLibrary } from "./PhotoLibrary";

/** The Gallery tab: every photo, grouped by the recipe it was shot with. */
export function PhotoGallery() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const empty = Object.keys(photosByRecipe.value).length === 0;

  const add = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    const r = await importPhotos(files);
    setBusy(false);
    // Photos without a recipe don't show up here; say where they went.
    if (r.scenes > 0) showToast(t("photosToScenes", { n: r.scenes }), "info", 6000);
  };

  return (
    <div class="gallery photo-gallery">
      <div class="toolbar">
        <div class="toolbar-actions">
          <button class="primary" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "…" : `＋ ${t("importPhotosBtn")}`}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept={PHOTO_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            const el = e.currentTarget;
            const files = Array.from(el.files ?? []);
            el.value = "";
            void add(files);
          }}
        />
      </div>
      {empty ? <p class="empty">{t("photoGalleryEmpty")}</p> : <PhotoLibrary recipes={allRecipes.value} />}
    </div>
  );
}
