import { useEffect, useRef, useState } from "preact/hooks";
import { pcExt } from "../np3/recipe";
import { legacyCamera, viewParams } from "../camera";
import { t, tx } from "../i18n";
import type { Recipe } from "../np3/recipe";
import { renderThumbnail, type PreparedSource } from "../render/renderer";
import { photosByRecipe } from "../photos";
import { detailId } from "../state";
import { IconCamera } from "./Icons";
import { CardButton } from "./CardButton";

// Render thumbnails one at a time so the page stays responsive.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

export function sourceBadge(r: Recipe): string {
  if (r.origin?.kind === "reddit") return t("originReddit");
  if (r.origin?.kind === "imaging-cloud") return t("originCloud");
  if (r.origin?.kind === "card") return t("originCard");
  if (r.origin?.kind === "community") return r.author ?? t("originCommunity");
  return r.source === "builtin" ? t("sourceBuiltin") : r.source === "mine" ? t("sourceMine") : t("sourceImported");
}

/** CSS class for the badge colour: origin wins over source. */
export const badgeClass = (r: Recipe) => r.origin?.kind ?? r.source;

export function RecipeCard({
  recipe,
  source,
  poster = false,
}: {
  recipe: Recipe;
  source: PreparedSource | null;
  poster?: boolean;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const photos = photosByRecipe.value[recipe.id] ?? [];
  const cover = photos[0];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && setVisible(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!source || !visible || cover) return;
    let alive = true;
    enqueue(() => renderThumbnail(source, viewParams(recipe), 520)).then((url) => alive && setThumb(url));
    return () => {
      alive = false;
    };
  }, [source, recipe.params, legacyCamera.value, visible, !!cover]);

  return (
    <article class={`card photo-card${poster ? " poster" : ""}`} ref={ref}>
      <button class="card-thumb" onClick={() => (detailId.value = recipe.id)} aria-label={tx(recipe.title)}>
        {cover ? (
          <img src={cover.thumbUrl} alt="" draggable={false} />
        ) : thumb ? (
          <img src={thumb} alt="" draggable={false} />
        ) : (
          <div class="thumb-placeholder" />
        )}
        <div class="card-scrim" aria-hidden="true" />
        {photos.length > 0 && (
          <span class="card-photo-pill">
            <IconCamera size={11} /> {photos.length}
          </span>
        )}
        {!recipe.params && <span class="badge floating left warn">{recipe.raw ? pcExt(recipe.raw).slice(1) : "NP3"}</span>}
        <div class="card-overlay-text">
          <span class="card-overlay-title">{tx(recipe.title)}</span>
          <span class="card-overlay-sub mono">{recipe.npName}</span>
        </div>
      </button>
      <CardButton recipe={recipe} className="card-quick-add" compact />
    </article>
  );
}
