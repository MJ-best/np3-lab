import { useState } from "preact/hooks";
import { t, tx } from "../i18n";
import type { Recipe } from "../np3/recipe";
import { photosByRecipe, type PhotoThumb } from "../photos";
import { openRecipePhotos } from "../state";
import { Lightbox } from "./RecipePhotos";

/** How many photos a recipe shows here before "+N" (the rest are one click away in the recipe). */
const PER_RECIPE = 12;

/**
 * "My photos": every photo you've added, grouped by the recipe it was shot with, newest
 * recipe first — the place to look back at what each recipe actually looks like.
 */
export function PhotoLibrary({ recipes, orphans = [] }: { recipes: Recipe[]; orphans?: PhotoThumb[] }) {
  const [open, setOpen] = useState<{ group: string; index: number } | null>(null);
  const groups = recipes
    .map((r) => ({ id: r.id, recipe: r as Recipe | undefined, photos: photosByRecipe.value[r.id] ?? [] }))
    .filter((g) => g.photos.length > 0)
    .sort((a, b) => b.photos[0].createdAt - a.photos[0].createdAt);
  // Photos whose recipe is gone come last, so they can still be looked at and deleted.
  if (orphans.length > 0) groups.push({ id: "", recipe: undefined, photos: orphans });
  const openPhotos = groups.find((g) => g.id === open?.group)?.photos ?? [];

  return (
    <div class="photo-library">
      {groups.map(({ id, recipe, photos }) => (
        <section key={id} class="photo-group">
          {recipe ? (
            <button class="photo-group-head" onClick={() => openRecipePhotos(recipe.id)}>
              <span class="photo-group-title">{tx(recipe.title)}</span>
              <span class="count">{photos.length}</span>
              {recipe.author && <span class="muted small">{recipe.author}</span>}
              <span class="photo-group-open">{t("openRecipe")} ›</span>
            </button>
          ) : (
            <div class="photo-group-head orphan">
              <span class="photo-group-title">{t("photosWithoutRecipe")}</span>
              <span class="count">{photos.length}</span>
            </div>
          )}
          <div class="photo-wall small">
            {photos.slice(0, recipe ? PER_RECIPE : undefined).map((p, i) => (
              <button key={p.id} class="photo-tile" onClick={() => setOpen({ group: id, index: i })} aria-label={p.name}>
                <img src={p.thumbUrl} alt="" loading="lazy" draggable={false} />
              </button>
            ))}
            {recipe && photos.length > PER_RECIPE && (
              <button class="photo-tile more" onClick={() => openRecipePhotos(recipe.id)}>
                +{photos.length - PER_RECIPE}
              </button>
            )}
          </div>
        </section>
      ))}
      {open && openPhotos[open.index] && (
        <Lightbox
          photos={openPhotos}
          index={open.index}
          onClose={() => setOpen(null)}
          onIndex={(index) => setOpen({ group: open.group, index })}
        />
      )}
    </div>
  );
}
