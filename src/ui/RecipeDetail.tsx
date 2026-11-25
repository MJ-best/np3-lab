import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { currentCamera, forCard, legacyCamera, viewParams } from "../camera";
import { t, tagLabel, tx, type MessageKey } from "../i18n";
import {
  BLENDER_COLORS,
  GRADING_RANGES,
  RANGES,
  SCALAR_KEYS,
  TONE_KEYS,
  NP_NAME_MAX,
  isFlexible,
  pcExt,
  recipeToBytes,
  sanitizeNpName,
  withNpName,
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
  askConfirm,
  detailTab,
  deleteMine,
  detailId,
  openInEditor,
  recipeById,
  setActiveSample,
  updateMine,
} from "../state";
import { BAND_HUES } from "./ColorPanels";
import { CompareSlider } from "./CompareSlider";
import { IconCamera, IconClose, IconLink } from "./Icons";
import { haptic } from "../native";
import { copyText } from "./Editor";
import { usePreparedSample, useScrollLock } from "./hooks";
import { badgeClass, sourceBadge } from "./RecipeCard";
import { cardRecipeById } from "../cards";
import { CardButton } from "./CardButton";
import { RecipePhotos } from "./RecipePhotos";
import { photosByRecipe } from "../photos";
import { SceneChips } from "./SceneChips";
import { canShare, shareBusy, shareRecipe } from "../share";
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
  // Card files that aren't in the library are renamed on the card screen instead.
  const editable = recipe.source !== "builtin" && !recipe.id.startsWith("card:");
  if (editing) {
    return (
      <div class="origin-edit">
        <label class="field">
          <span>{t("titleField")}</span>
          <input value={tx(recipe.title)} onInput={(e) => updateMine(recipe.id, { title: e.currentTarget.value })} />
        </label>
        <label class="field">
          <span>{t("cameraName")}</span>
          <input
            class="mono"
            value={recipe.npName}
            maxLength={NP_NAME_MAX}
            spellcheck={false}
            onChange={(e) => {
              const input = e.currentTarget;
              const npName = input.value.trim() ? sanitizeNpName(input.value) : recipe.npName;
              input.value = npName;
              if (npName !== recipe.npName) updateMine(recipe.id, { npName, raw: recipe.raw && withNpName(recipe.raw, npName) });
            }}
          />
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
  const photoCount = inLibrary ? (photosByRecipe.value[recipe.id]?.length ?? 0) : 0;
  // On an older body: how it will look there, and the original Picture Control it is saved as.
  const legacy = legacyCamera.value;
  const shown = useMemo(() => viewParams(recipe), [recipe, legacy]);
  const outBytes = useMemo(() => {
    try {
      return recipeToBytes(forCard(recipe));
    } catch {
      return null;
    }
  }, [recipe, legacy]);
  const hasPhotos = photoCount > 0;
  const [view, setView] = useState<"photos" | "preview">(() => detailTab.value ?? (hasPhotos ? "photos" : "preview"));
  useEffect(() => {
    detailTab.value = null;
  }, []);
  // The first photos added from the empty state: show them where they went.
  const hadPhotos = useRef(hasPhotos);
  useEffect(() => {
    if (hasPhotos && !hadPhotos.current) setView("photos");
    hadPhotos.current = hasPhotos;
  }, [hasPhotos]);

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
      <div class="detail-mobile-head">
        <span class={`badge ${badgeClass(recipe)}`}>{sourceBadge(recipe)}</span>
        <strong class="detail-mobile-title">{tx(recipe.title)}</strong>
        <button class="icon-btn" aria-label={t("close")} onClick={() => (detailId.value = null)}>
          <IconClose size={16} />
        </button>
      </div>
      <div class="detail-media">
        {hasPhotos && (
          <div class="segmented media-tabs" role="tablist">
            <button role="tab" aria-selected={view === "photos"} class={view === "photos" ? "active" : ""} onClick={() => setView("photos")}>
              <span class="btn-inline">
                <IconCamera size={14} />
                {t("myPhotosTab", { n: photoCount })}
              </span>
            </button>
            <button role="tab" aria-selected={view === "preview"} class={view === "preview" ? "active" : ""} onClick={() => setView("preview")}>
              {t("previewTab")}
            </button>
          </div>
        )}
        {hasPhotos && view === "photos" ? (
          // Real photos shot with the recipe come first: they show it better than any simulation.
          <RecipePhotos recipeId={recipe.id} layout="wall" />
        ) : (
          <>
            <SceneChips />
            {recipe.params ? (
              <CompareSlider source={source} params={shown} maxHeight={620} />
            ) : (
              <div class="no-preview">{t("noPreview")}</div>
            )}
            <p class="hint">{t("approxPreview")}</p>
            {legacyCamera.value && isFlexible(recipe) && recipe.params && (
              <p class="hint warn-text">{t("legacyPreviewNote", { model: currentCamera.value.label || t("otherZ") })}</p>
            )}
            {inLibrary && !hasPhotos && <RecipePhotos recipeId={recipe.id} />}
          </>
        )}
      </div>
      <aside class="detail-info">
        <div class="detail-head">
          <span class={`badge ${badgeClass(recipe)}`}>{sourceBadge(recipe)}</span>
          <button class="icon-btn" aria-label={t("close")} onClick={() => (detailId.value = null)}>
            <IconClose size={16} />
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
        <div class="detail-actions">
          {inLibrary && <CardButton recipe={recipe} className="primary detail-cta" big />}
          {(recipe.params || outBytes) && (
            <div class="detail-action-grid">
              {recipe.params && (
                <button onClick={() => openInEditor(recipe)}>{editable ? t("openInEditor") : t("duplicateEdit")}</button>
              )}
              {outBytes && (
                <button onClick={() => downloadBytes(outBytes, `${fileBaseFor(recipe)}${pcExt(outBytes)}`)}>
                  {t("downloadFile", { ext: pcExt(outBytes).slice(1) })}
                </button>
              )}
            </div>
          )}
          <div class="detail-action-more">
            {recipe.params && (
              <button class="ghost small-btn" onClick={() => copyText(formatRecipeText(recipe.npName, recipe.params!))}>
                {t("copyText")}
              </button>
            )}
            {canShare(recipe) && (
              <button class="ghost small-btn" disabled={shareBusy.value} onClick={() => void shareRecipe(recipe)}>
                <span class="btn-inline">
                  <IconLink size={14} />
                  {shareBusy.value ? "…" : t("shareLink")}
                  <span class="pro-tag">Pro</span>
                </span>
              </button>
            )}
            {recipe.source !== "builtin" && inLibrary && (
              <button
                class="danger ghost small-btn"
                onClick={async () => {
                  const name = tx(recipe.title);
                  const ok = await askConfirm({
                    message: photoCount > 0 ? t("confirmDeleteWithPhotos", { name, n: photoCount }) : t("confirmDelete", { name }),
                    confirmLabel: t("deleteRecipe"),
                    danger: true,
                  });
                  if (ok) {
                    deleteMine(recipe.id);
                    detailId.value = null;
                  }
                }}
              >
                {t("deleteRecipe")}
              </button>
            )}
          </div>
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

const overlayStack: (() => void)[] = [];

/**
 * Backdrop for dialogs & mobile bottom sheets.
 * - Escape / Android Back only closes the topmost overlay in the stack.
 * - On mobile (when `sheet` is true), dragging down from the grabber or scrolled-top sheet dismisses it.
 */
export function Overlay({
  onClose,
  children,
  sheet = true,
}: {
  onClose: () => void;
  children: ComponentChildren;
  sheet?: boolean;
}) {
  useScrollLock();
  const downOnBackdrop = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  const [nested] = useState(() => overlayStack.length > 0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const touchState = useRef<{ y0: number; t0: number; active: boolean; scrollEl: HTMLElement | null } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const entry = () => close.current();
    overlayStack.push(entry);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && overlayStack[overlayStack.length - 1] === entry) {
        e.stopImmediatePropagation();
        entry();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const idx = overlayStack.lastIndexOf(entry);
      if (idx >= 0) overlayStack.splice(idx, 1);
    };
  }, []);

  const onTouchStart = (e: TouchEvent) => {
    if (!sheet || e.touches.length !== 1) return;
    if (typeof window !== "undefined" && window.innerWidth > 760) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('.compare, [role="slider"], input, textarea, .curve, .wheel')) return;
    const wrap = wrapRef.current;
    const scrollEl = (wrap?.lastElementChild as HTMLElement | null) ?? null;
    const onGrabber = !!target?.closest(".sheet-grabber");
    if (!onGrabber && scrollEl && scrollEl.scrollTop > 2) return;
    touchState.current = { y0: e.touches[0].clientY, t0: performance.now(), active: false, scrollEl };
  };

  const onTouchMove = (e: TouchEvent) => {
    const st = touchState.current;
    if (!st || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - st.y0;
    if (!st.active) {
      if (dy < 8) return;
      if (st.scrollEl && st.scrollEl.scrollTop > 2) {
        touchState.current = null;
        return;
      }
      st.active = true;
      setDragging(true);
    }
    if (dy > 0) {
      e.preventDefault();
      setDragY(dy);
    } else {
      setDragY(0);
    }
  };

  const onTouchEnd = () => {
    const st = touchState.current;
    touchState.current = null;
    if (!st?.active) return;
    const dt = Math.max(1, performance.now() - st.t0);
    const velocity = dragY / dt;
    setDragging(false);
    if (dragY > 90 || (dragY > 45 && velocity > 0.45)) {
      haptic("light");
      setDragY(0);
      close.current();
    } else {
      setDragY(0);
    }
  };

  return (
    <div
      class={`overlay${sheet ? " sheet-overlay" : ""}${nested ? " nested" : ""}`}
      onPointerDown={(e) => (downOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose();
      }}
    >
      {sheet ? (
        <div
          ref={wrapRef}
          class={`sheet-wrap${dragging ? " dragging" : ""}`}
          style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
        >
          <div class="sheet-grabber" aria-hidden="true" />
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
