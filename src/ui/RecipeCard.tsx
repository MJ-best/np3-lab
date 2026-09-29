import { useEffect, useRef, useState } from "preact/hooks";
import { t, tagLabel, tx } from "../i18n";
import type { Recipe } from "../np3/recipe";
import { renderThumbnail, type PreparedSource } from "../render/renderer";
import { detailId } from "../state";
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

export function RecipeCard({ recipe, source }: { recipe: Recipe; source: PreparedSource | null }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && setVisible(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!source || !visible) return;
    let alive = true;
    enqueue(() => renderThumbnail(source, recipe.params ?? null, 520)).then((url) => alive && setThumb(url));
    return () => {
      alive = false;
    };
  }, [source, recipe.params, visible]);

  return (
    <article class="card" ref={ref}>
      <button class="card-thumb" onClick={() => (detailId.value = recipe.id)} aria-label={tx(recipe.title)}>
        {thumb ? <img src={thumb} alt="" draggable={false} /> : <div class="thumb-placeholder" />}
        <span class={`badge floating ${badgeClass(recipe)}`}>{sourceBadge(recipe)}</span>
        {!recipe.params && <span class="badge floating right warn">NP3</span>}
      </button>
      <div class="card-body">
        <div class="card-title-row">
          <button class="card-title" onClick={() => (detailId.value = recipe.id)}>
            {tx(recipe.title)}
          </button>
          <CardButton recipe={recipe} className="add-btn" />
        </div>
        <div class="card-meta">
          <code>{recipe.npName}</code>
          {recipe.tags.slice(0, 3).map((tag) => (
            <span key={tag} class="tag">
              {tagLabel(tag)}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
