import { signal } from "@preact/signals";
import { t } from "./i18n";
import { haptic } from "./native";
import { addPhotos, matchRecipeByExif } from "./photos";
import { isPhotoFile } from "./raw";
import { addUserPhoto, allRecipes, detailId, openRecipePhotos, route, showToast } from "./state";

/*
 * One rule for every way photos are imported (window drop, "Add photos" on a recipe,
 * the Gallery tab, Import → Photos): a Nikon photo goes to the recipe named in its
 * EXIF. Only photos without a known recipe go to the fallback — the recipe being
 * viewed, a recipe picker dialog when imported from Gallery, or a preview scene when dropped.
 */

export interface PhotoImportResult {
  /** Photos stored in a recipe gallery because their EXIF named it. */
  filed: number;
  /** Recipes those photos went to. */
  recipes: number;
  /** Photos without a known recipe that went to `into`. */
  intoFallback: number;
  /** Photos without a known recipe that became preview scenes. */
  scenes: number;
}

/** Live EXIF-analysis progress for multi-photo imports (null when idle). */
export const photoImportProgress = signal<{ done: number; total: number } | null>(null);
/** Photos imported without recipe EXIF waiting for the user to pick a destination recipe. */
export const unmatchedPhotos = signal<File[] | null>(null);

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function assignUnmatchedToRecipe(recipeId: string) {
  const files = unmatchedPhotos.value;
  unmatchedPhotos.value = null;
  if (!files || files.length === 0) return;
  const n = await addPhotos(recipeId, files);
  if (n > 0) {
    haptic("success");
    showToast(t("photosAdded", { n }), "ok");
  }
}

export async function assignUnmatchedAsScenes() {
  const files = unmatchedPhotos.value;
  unmatchedPhotos.value = null;
  if (!files || files.length === 0) return;
  for (const f of files) await addUserPhoto(f);
}

export function dismissUnmatchedPhotos() {
  unmatchedPhotos.value = null;
}

export async function importPhotos(
  files: File[],
  opts: { into?: string; askOnUnknown?: boolean } = {},
): Promise<PhotoImportResult> {
  const photos = files.filter(isPhotoFile);
  const result: PhotoImportResult = { filed: 0, recipes: 0, intoFallback: 0, scenes: 0 };
  if (photos.length === 0) return result;

  const byRecipe = new Map<string, File[]>();
  const unknown: File[] = [];
  photoImportProgress.value = { done: 0, total: photos.length };
  try {
    for (let i = 0; i < photos.length; i++) {
      const f = photos[i];
      photoImportProgress.value = { done: i + 1, total: photos.length };
      if (i > 0) await nextTick();
      const recipe = await matchRecipeByExif(f, allRecipes.value);
      if (recipe) byRecipe.set(recipe.id, [...(byRecipe.get(recipe.id) ?? []), f]);
      else unknown.push(f);
    }

    let toThis = 0;
    let elsewhere = 0;
    const elsewhereIds: string[] = [];
    for (const [id, list] of byRecipe) {
      const n = await addPhotos(id, list);
      if (n === 0) continue;
      result.filed += n;
      result.recipes++;
      if (id === opts.into) toThis += n;
      else {
        elsewhere += n;
        elsewhereIds.push(id);
      }
    }
    if (opts.into) {
      result.intoFallback = await addPhotos(opts.into, unknown);
      toThis += result.intoFallback;
    } else if (opts.askOnUnknown && unknown.length > 0) {
      unmatchedPhotos.value = unknown;
    } else {
      for (const f of unknown) if (await addUserPhoto(f)) result.scenes++;
    }

    if (toThis > 0 || elsewhere > 0) haptic("success");

    // Say where things went, especially photos that landed in another recipe than the one on screen.
    if (toThis > 0) showToast(t("photosAdded", { n: toThis }), "ok");
    if (elsewhere > 0) {
      showToast(t("photosFiled", { n: elsewhere, m: elsewhereIds.length }), "ok", 8000, {
        label: t("viewPhotos"),
        run: () => {
          // One recipe: open its gallery. Several: the Gallery tab, grouped by recipe.
          if (elsewhereIds.length === 1) openRecipePhotos(elsewhereIds[0]);
          else {
            detailId.value = null;
            route.value = "photos";
          }
        },
      });
    }
    return result;
  } finally {
    photoImportProgress.value = null;
  }
}
