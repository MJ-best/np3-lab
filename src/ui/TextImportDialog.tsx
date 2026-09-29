import { useEffect, useMemo, useState } from "preact/hooks";
import { t } from "../i18n";
import { sanitizeNpName, type RecipeParams } from "../np3/recipe";
import { extractSourceMeta, parseRecipes, type ParsedBlock } from "../np3/textFormat";
import { renderThumbnail, type PreparedSource } from "../render/renderer";
import { activeSample, loadParamsIntoEditor, pasteOpen, saveTextRecipes } from "../state";
import { usePreparedSample } from "./hooks";
import { Overlay } from "./RecipeDetail";

const PLACEHOLDER = `Warm Portra-ish
Contrast: -10
Highlights: -25
Shadows: +15
Saturation: -5
Reds: Hue +4 / Chroma -8 / Brightness +6

Cool Night Street
Contrast: +10
Highlights: -40
Color Grading:
  Shadows: Hue 210 / Chroma +12 / Brightness 0`;

const toNpName = (title: string) => sanitizeNpName(title).toUpperCase().replace(/ /g, "_");

interface Override {
  selected?: boolean;
  title?: string;
  npName?: string;
}

function Thumb({ source, params }: { source: PreparedSource | null; params: RecipeParams }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!source) return;
    let alive = true;
    renderThumbnail(source, params, 240).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [source, params]);
  return url ? <img class="block-thumb" src={url} alt="" /> : <div class="block-thumb" />;
}

export function TextImportDialog() {
  const [text, setText] = useState("");
  const [overrides, setOverrides] = useState<Record<number, Override>>({});
  const [meta, setMeta] = useState<{ url: string; author: string }>({ url: "", author: "" });
  /** Once the user edits the author field it applies to every recipe, overriding detected authors. */
  const [authorEdited, setAuthorEdited] = useState(false);
  const [addToCard, setAddToCard] = useState(false);
  const source = usePreparedSample(activeSample.value);

  const blocks: ParsedBlock[] = useMemo(() => (text.trim() ? parseRecipes(text) : []), [text]);
  const detected = useMemo(() => extractSourceMeta(text), [text]);
  const linkOnly = /^\s*https?:\/\/\S+\s*$/.test(text);

  // New text → forget per-recipe edits and re-detect the source.
  useEffect(() => {
    setOverrides({});
    setMeta({ url: detected.url ?? "", author: detected.author ?? "" });
    setAuthorEdited(false);
  }, [text]);

  if (!pasteOpen.value) return null;

  const close = () => {
    pasteOpen.value = false;
    setText("");
  };
  const fallbackName = (i: number) => (detected.kind === "reddit" ? `REDDIT_${i + 1}` : `RECIPE_${i + 1}`);
  const view = blocks.map((b, i) => {
    const o = overrides[i] ?? {};
    const title = o.title ?? b.title ?? fallbackName(i);
    return {
      block: b,
      selected: o.selected ?? true,
      title,
      npName: o.npName ?? (b.name ? sanitizeNpName(b.name) : toNpName(title)),
    };
  });
  const chosen = view.filter((v) => v.selected);
  const edit = (i: number, patch: Override) => setOverrides((prev) => ({ ...prev, [i]: { ...prev[i], ...patch } }));

  const save = () => {
    const url = meta.url.trim();
    const kind = /reddit\.com|redd\.it/i.test(url) || (detected.kind === "reddit" && !url) ? "reddit" : url ? "community" : "text";
    saveTextRecipes(
      chosen.map((v) => ({
        title: v.title,
        npName: v.npName,
        params: v.block.params,
        author: authorEdited ? undefined : v.block.author,
      })),
      { kind, url: url || undefined, author: meta.author.trim() || undefined },
      addToCard,
    );
    close();
  };

  return (
    <Overlay onClose={close}>
      <div class="dialog wide" role="dialog" aria-modal="true" aria-label={t("pasteTitle")}>
        <div class="detail-head">
          <h2>{t("pasteTitle")}</h2>
          <button class="icon-btn" aria-label={t("close")} onClick={close}>
            ✕
          </button>
        </div>
        <p class="hint">{t("pasteHelp")}</p>
        <textarea
          class="mono"
          rows={blocks.length > 0 ? 6 : 12}
          placeholder={PLACEHOLDER}
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
          autoFocus
        />

        {linkOnly && <p class="warn-text">{t("redditLinkOnly")}</p>}
        {text.trim() && !linkOnly && (
          <p class={blocks.length > 0 ? "ok-text" : "warn-text"}>
            {blocks.length > 0 ? t("foundRecipes", { n: blocks.length }) : t("noRecipesFound")}
          </p>
        )}

        {view.length > 0 && (
          <>
            <ul class="review-list">
              {view.map((v, i) => (
                <li key={i}>
                  <input type="checkbox" checked={v.selected} onChange={(e) => edit(i, { selected: e.currentTarget.checked })} aria-label={v.title} />
                  <Thumb source={source} params={v.block.params} />
                  <div class="review-main">
                    <input class="review-title" value={v.title} onInput={(e) => edit(i, { title: e.currentTarget.value })} />
                    <span class="review-meta">
                      <input
                        class="mono np-inline"
                        value={v.npName}
                        maxLength={19}
                        spellcheck={false}
                        onInput={(e) => edit(i, { npName: e.currentTarget.value.replace(/[^A-Za-z0-9 _\-]/g, "") })}
                        aria-label={t("cameraName")}
                      />
                      <span>{t("valuesCount", { n: v.block.recognized })}</span>
                      {v.block.author && !authorEdited && <span>u/{v.block.author}</span>}
                    </span>
                  </div>
                  <button
                    class="small-btn"
                    onClick={() => {
                      loadParamsIntoEditor(v.block.params, v.title, v.npName);
                      close();
                    }}
                  >
                    {t("openOneInEditor")}
                  </button>
                </li>
              ))}
            </ul>
            <div class="meta-row">
              <label class="field">
                <span>{t("sourceUrl")}</span>
                <input value={meta.url} placeholder="https://www.reddit.com/r/…" onInput={(e) => setMeta({ ...meta, url: e.currentTarget.value })} />
              </label>
              <label class="field">
                <span>{t("authorField")}</span>
                <input
                  value={meta.author}
                  onInput={(e) => {
                    setAuthorEdited(true);
                    setMeta({ ...meta, author: e.currentTarget.value });
                  }}
                />
              </label>
            </div>
          </>
        )}

        <div class="button-row end">
          {view.length > 0 && (
            <label class="radio inline">
              <input type="checkbox" checked={addToCard} onChange={(e) => setAddToCard(e.currentTarget.checked)} />
              {t("alsoAddToCard")}
            </label>
          )}
          <button class="ghost" onClick={close}>
            {t("cancel")}
          </button>
          <button class="primary" disabled={chosen.length === 0} onClick={save}>
            {t("saveSelected", { n: chosen.length })}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
