import { useRef, useState } from "preact/hooks";
import { t } from "../i18n";
import { importPhotos } from "../photoImport";
import { SCENES, photosByRecipe } from "../photos";
import { PHOTO_ACCEPT } from "../raw";
import { allRecipes, recipeById, recipeQuery } from "../state";
import { matchesQuery } from "./Gallery";
import { PhotoLibrary } from "./PhotoLibrary";

/** The Gallery tab: every photo, grouped by the recipe it was shot with. */
export function PhotoGallery() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Only recipe photos count here (preview scenes live in the same library).
  const withPhotos = allRecipes.value.filter((r) => photosByRecipe.value[r.id]?.length);
  // Photos whose recipe is gone (deleted, or a community recipe removed) stay visible so they can be deleted.
  const orphans = Object.entries(photosByRecipe.value)
    .filter(([id]) => id !== SCENES && !recipeById.value.has(id))
    .flatMap(([, list]) => list)
    .sort((a, b) => b.createdAt - a.createdAt);
  const empty = withPhotos.length === 0 && orphans.length === 0;
  const query = recipeQuery.value;
  const visible = withPhotos.filter((r) => matchesQuery(r, query));
  const shownOrphans = query.trim() ? [] : orphans;

  const add = async (files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    await importPhotos(files);
    setBusy(false);
  };

  return (
    <div class="gallery photo-gallery">
      <div class="toolbar">
        <input class="search" type="search" placeholder={t("search")} value={query} onInput={(e) => (recipeQuery.value = e.currentTarget.value)} />
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
      {empty ? (
        <p class="empty">{t("photoGalleryEmpty")}</p>
      ) : visible.length === 0 && shownOrphans.length === 0 ? (
        <p class="empty">{t("noResults")}</p>
      ) : (
        <PhotoLibrary recipes={visible} orphans={shownOrphans} />
      )}
    </div>
  );
}
