import { useRef, useState } from "preact/hooks";
import { t } from "../i18n";
import { importPhotos } from "../photoImport";
import { SCENES, photosByRecipe } from "../photos";
import { PHOTO_ACCEPT } from "../raw";
import { allRecipes, photoQuery, recipeById } from "../state";
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
  const query = photoQuery.value;
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
      {empty ? (
        <div class="empty-hero">
          <div class="empty-hero-icon" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="72" height="72">
              <rect x="8" y="14" width="48" height="36" rx="5" fill="none" stroke="currentColor" stroke-width="3" />
              <circle cx="22" cy="27" r="4" fill="currentColor" />
              <path d="M10 44l14-12 10 9 8-7 12 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <h2>{t("photoGalleryEmptyTitle")}</h2>
          <p>{t("photoGalleryEmpty")}</p>
          <p>
            <button class="primary big" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "…" : `＋ ${t("importFirstPhotosBtn")}`}
            </button>
          </p>
          <ul class="empty-features">
            <li>{t("photoFeatureExif")}</li>
            <li>{t("photoFeatureRaw")}</li>
            <li>{t("photoFeatureLocal")}</li>
          </ul>
        </div>
      ) : (
        <>
          <div class="toolbar">
            <input class="search" type="search" placeholder={t("search")} value={query} onInput={(e) => (photoQuery.value = e.currentTarget.value)} />
            <div class="toolbar-actions">
              <button class="primary" disabled={busy} onClick={() => input.current?.click()}>
                {busy ? "…" : `＋ ${t("importPhotosBtn")}`}
              </button>
            </div>
          </div>
          {visible.length === 0 && shownOrphans.length === 0 ? (
            <div class="empty-search">
              <p class="empty">{t("noResults")}</p>
              {query.trim() && <button onClick={() => (photoQuery.value = "")}>{t("clearSearch")}</button>}
            </div>
          ) : (
            <PhotoLibrary recipes={visible} orphans={shownOrphans} />
          )}
        </>
      )}
    </div>
  );
}
