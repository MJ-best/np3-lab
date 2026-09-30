import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { t, tagLabel, tx, type MessageKey } from "../i18n";
import {
  BLENDER_COLORS,
  GRADING_RANGES,
  RANGES,
  SCALAR_KEYS,
  TONE_KEYS,
  recipeToBytes,
  type Recipe,
  type RecipeParams,
} from "../np3/recipe";
import { formatRecipeText } from "../np3/textFormat";
import { lookOf } from "../look";
import { downloadBytes } from "../pack/download";
import { fileBaseFor } from "../pack/naming";
import {
  activeSample,
  allSamples,
  deleteMine,
  detailId,
  openInEditor,
  recipeById,
  setActiveSample,
  updateMine,
} from "../state";
import { BAND_HUES } from "./ColorPanels";
import { CompareSlider } from "./CompareSlider";
import { copyText } from "./Editor";
import { usePreparedSample } from "./hooks";
import { badgeClass, sourceBadge } from "./RecipeCard";
import { cardRecipeById } from "../cards";
import { CardButton } from "./CardButton";
import { RecipePhotos } from "./RecipePhotos";
import { SceneChips } from "./SceneChips";
import { formatValue } from "./Slider";

const RANGE_KEYS: Record<string, MessageKey> = { shadows: "rangeShadows", midTone: "rangeMidTone", highlights: "rangeHighlights" };
const ORIGIN_KEYS: Record<NonNullable<Recipe["origin"]>["kind"], MessageKey> = {
  reddit: "originReddit",
  "imaging-cloud": "originCloud",
  community: "originCommunity",
  text: "originText",
  file: "originFile",
  card: "originCard",
};

/** Only open web links (never javascript: or file: URLs pasted from elsewhere). */
const safeUrl = (url: string | undefined) => (url && /^https?:\/\//i.test(url) ? url : undefined);

function OriginInfo({ recipe }: { recipe: Recipe }) {
  const [editing, setEditing] = useState(false);
  const o = recipe.origin;
  const editable = recipe.source !== "builtin";
  if (editing) {
    return (
      <div class="origin-edit">
        <label class="field">
          <span>{t("titleField")}</span>
          <input value={tx(recipe.title)} onInput={(e) => updateMine(recipe.id, { title: e.currentTarget.value })} />
        </label>
        <label class="field">
          <span>{t("authorField")}</span>
          <input
            value={o?.author ?? ""}
            onInput={(e) => updateMine(recipe.id, { origin: { kind: o?.kind ?? "text", ...o, author: e.currentTarget.value || undefined } })}
          />
        </label>
        <label class="field">
          <span>{t("sourceUrl")}</span>
          <input
            value={o?.url ?? ""}
            placeholder="https://"
            onInput={(e) => updateMine(recipe.id, { origin: { kind: o?.kind ?? "community", ...o, url: e.currentTarget.value || undefined } })}
          />
        </label>
        <button onClick={() => setEditing(false)}>{t("done")}</button>
      </div>
    );
  }
  const url = safeUrl(o?.url);
  return (
    <div class="origin">
      {o && (
        <p>
          {t("originLabel")}: {t(ORIGIN_KEYS[o.kind])}
          {o.author && <> · {o.kind === "reddit" ? `u/${o.author}` : o.author}</>}
          {url && (
            <>
              {" · "}
              <a href={url} target="_blank" rel="noopener noreferrer">
                {t("viewOriginal")}
              </a>
            </>
          )}
        </p>
      )}
      {o?.kind === "imaging-cloud" && <p class="hint warn-text">{t("cloudRights")}</p>}
      {editable && (
        <button class="link" onClick={() => setEditing(true)}>
          {t("editInfo")}
        </button>
      )}
    </div>
  );
}

/** Concept (read from the values), recommended scenes and release date. */
function RecipeNotes({ recipe }: { recipe: Recipe }) {
  const look = recipe.params ? lookOf(recipe.params, recipe.tags.includes("mono")) : null;
  if (!look && !recipe.use && !recipe.released) return null;
  return (
    <dl class="notes">
      {look && (
        <div>
          <dt>{t("lookConcept")}</dt>
          <dd title={t("lookAuto")}>{tx(look.summary)}</dd>
        </div>
      )}
      {recipe.use && (
        <div>
          <dt>{t("recommendedUse")}</dt>
          <dd>{tx(recipe.use)}</dd>
        </div>
      )}
      {recipe.released && (
        <div>
          <dt>{t("releasedOn")}</dt>
          <dd>{recipe.released}</dd>
        </div>
      )}
      {recipe.noteCredit && (
        <div>
          <dt>{t("noteSource")}</dt>
          <dd class="muted">{recipe.noteCredit}</dd>
        </div>
      )}
    </dl>
  );
}

function ParamSummary({ p }: { p: RecipeParams }) {
  const rows: [string, string][] = [];
  for (const k of SCALAR_KEYS) {
    if (p.toneCurve && (TONE_KEYS as readonly string[]).includes(k)) continue;
    const v = p[k] ?? RANGES[k].def;
    if (Math.abs(v - RANGES[k].def) > 1e-9) rows.push([t(k), formatValue(v, RANGES[k].step)]);
  }
  return (
    <div class="summary">
      {rows.length > 0 && (
        <dl class="kv">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.toneCurve && <p class="pill">〰 {t("toneCurveInUse")}</p>}
      {BLENDER_COLORS.some((c) => p.colorBlender?.[c]) && (
        <div class="summary-block">
          <h4>{t("secBlender")}</h4>
          {BLENDER_COLORS.filter((c) => p.colorBlender?.[c]).map((c) => {
            const v = p.colorBlender![c]!;
            return (
              <div class="summary-line" key={c}>
                <span class="grading-dot" style={{ background: `hsl(${BAND_HUES[c]} 80% 52%)` }} />
                <span class="summary-name">{t(c)}</span>
                <span class="mono">
                  H {formatValue(v.hue ?? 0, 1)} · C {formatValue(v.chroma ?? 0, 1)} · B {formatValue(v.brightness ?? 0, 1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {GRADING_RANGES.some((r) => p.colorGrading?.[r]) && (
        <div class="summary-block">
          <h4>{t("secGrading")}</h4>
          {GRADING_RANGES.filter((r) => p.colorGrading?.[r]).map((r) => {
            const v = p.colorGrading![r]!;
            return (
              <div class="summary-line" key={r}>
                <span class="grading-dot" style={{ background: `hsl(${v.hue ?? 0} 70% 55%)` }} />
                <span class="summary-name">{t(RANGE_KEYS[r])}</span>
                <span class="mono">
                  {v.hue ?? 0}° · C {formatValue(v.chroma ?? 0, 1)} · B {formatValue(v.brightness ?? 0, 1)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {rows.length === 0 && !p.toneCurve && !BLENDER_COLORS.some((c) => p.colorBlender?.[c]) && <p class="hint">{t("defaultsOnly")}</p>}
    </div>
  );
}

function DetailBody({ recipe }: { recipe: Recipe }) {
  const source = usePreparedSample(activeSample.value);
  const editable = recipe.source === "mine" && !recipe.raw;
  const inLibrary = !recipe.id.startsWith("card:");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [role=slider]")) return;
      const list = allSamples.value;
      const i = list.findIndex((s) => s.id === activeSample.value?.id);
      if (e.key === "]" || e.key === "PageDown") setActiveSample(list[(i + 1) % list.length].id);
      if (e.key === "[" || e.key === "PageUp") setActiveSample(list[(i - 1 + list.length) % list.length].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div class="detail" role="dialog" aria-modal="true" aria-label={tx(recipe.title)}>
      <div class="detail-media">
        <SceneChips />
        {recipe.params ? (
          <CompareSlider source={source} params={recipe.params} maxHeight={620} />
        ) : (
          <div class="no-preview">{t("noPreview")}</div>
        )}
        <p class="hint">{t("approxPreview")}</p>
        {inLibrary && <RecipePhotos recipeId={recipe.id} />}
      </div>
      <aside class="detail-info">
        <div class="detail-head">
          <span class={`badge ${badgeClass(recipe)}`}>{sourceBadge(recipe)}</span>
          <button class="icon-btn" aria-label={t("close")} onClick={() => (detailId.value = null)}>
            ✕
          </button>
        </div>
        <h2>{tx(recipe.title)}</h2>
        <p class="detail-camera">
          {t("cameraName")}: <code>{recipe.npName}</code>
        </p>
        {recipe.description && <p class="detail-desc">{tx(recipe.description)}</p>}
        <RecipeNotes recipe={recipe} />
        <OriginInfo recipe={recipe} />
        {recipe.tags.length > 0 && (
          <div class="card-meta">
            {recipe.tags.map((tag) => (
              <span key={tag} class="tag">
                {tagLabel(tag)}
              </span>
            ))}
          </div>
        )}
        <div class="button-col">
          {inLibrary && <CardButton recipe={recipe} className="primary" big />}
          {recipe.params && (
            <button onClick={() => openInEditor(recipe)}>{editable ? t("openInEditor") : t("duplicateEdit")}</button>
          )}
          <button onClick={() => downloadBytes(recipeToBytes(recipe), `${fileBaseFor(recipe)}.NP3`)}>{t("downloadNp3")}</button>
          {recipe.params && <button onClick={() => copyText(formatRecipeText(recipe.npName, recipe.params!))}>{t("copyText")}</button>}
          {recipe.source !== "builtin" && inLibrary && (
            <button
              class="danger ghost"
              onClick={() => {
                if (confirm(t("confirmDelete", { name: tx(recipe.title) }))) {
                  deleteMine(recipe.id);
                  detailId.value = null;
                }
              }}
            >
              {t("deleteRecipe")}
            </button>
          )}
        </div>
        {recipe.params && (
          <>
            <h3>{t("settings")}</h3>
            <ParamSummary p={recipe.params} />
          </>
        )}
      </aside>
    </div>
  );
}

export function RecipeDetail() {
  const id = detailId.value;
  const recipe = id ? recipeById.value.get(id) ?? cardRecipeById.value.get(id) : undefined;
  if (!recipe) return null;
  return (
    <Overlay onClose={() => (detailId.value = null)}>
      <DetailBody recipe={recipe} />
    </Overlay>
  );
}

/**
 * Backdrop for dialogs. Closes on Escape, or on a click that both starts and
 * ends on the backdrop itself (so dragging a slider out of the dialog doesn't close it).
 */
export function Overlay({ onClose, children }: { onClose: () => void; children: ComponentChildren }) {
  const downOnBackdrop = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div
      class="overlay"
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
