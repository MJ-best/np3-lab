import { t } from "./i18n";
import { addPhotos, matchRecipeByExif } from "./photos";
import { isPhotoFile } from "./raw";
import { addUserPhoto, allRecipes, detailId, openRecipePhotos, route, showToast } from "./state";

/*
 * One rule for every way a photo comes in (window drop, "Add photos" on a recipe,
 * "My photo" scene, Import → Photos): a Nikon photo goes to the recipe named in its
 * EXIF. Only photos without a known recipe go to the fallback — the recipe being
 * viewed, or a preview scene when there is none.
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

export async function importPhotos(files: File[], opts: { into?: string } = {}): Promise<PhotoImportResult> {
  const photos = files.filter(isPhotoFile);
  const byRecipe = new Map<string, File[]>();
  const unknown: File[] = [];
  for (const f of photos) {
    const recipe = await matchRecipeByExif(f, allRecipes.value);
    if (recipe) byRecipe.set(recipe.id, [...(byRecipe.get(recipe.id) ?? []), f]);
    else unknown.push(f);
  }

  const result: PhotoImportResult = { filed: 0, recipes: 0, intoFallback: 0, scenes: 0 };
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
  } else {
    for (const f of unknown) if (await addUserPhoto(f)) result.scenes++;
  }

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
}
