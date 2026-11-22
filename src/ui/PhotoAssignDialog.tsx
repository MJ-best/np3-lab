import { useMemo, useState } from "preact/hooks";
import { lang, t, tagLabel, tx } from "../i18n";
import { isAndroid } from "../native";
import { assignUnmatchedAsScenes, assignUnmatchedToRecipe, dismissUnmatchedPhotos, unmatchedPhotos } from "../photoImport";
import { allRecipes } from "../state";
import { Overlay } from "./RecipeDetail";

/** Prompt shown when photos imported from Gallery have no Nikon Picture Control EXIF. */
export function PhotoAssignDialog() {
  const files = unmatchedPhotos.value;
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRecipes.value.filter(
      (r) => !q || [tx(r.title), r.npName, r.author, ...r.tags.map(tagLabel)].join(" ").toLowerCase().includes(q),
    );
  }, [query, allRecipes.value, lang.value]);

  if (!files || files.length === 0) return null;

  const close = () => {
    setQuery("");
    dismissUnmatchedPhotos();
  };

  return (
    <Overlay onClose={close}>
      <div class="dialog assign-dialog" role="dialog" aria-modal="true" aria-label={t("assignPhotosTitle")}>
        <div class="detail-head">
          <h2>{t("assignPhotosTitle")}</h2>
          <button class="icon-btn" aria-label={t("close")} onClick={close}>
            ✕
          </button>
        </div>
        <p class="hint">{t("assignPhotosBody", { n: files.length })}</p>
        {allRecipes.value.length > 0 && (
          <div class="picker-bar">
            <input
              type="search"
              placeholder={t("search")}
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
              autoFocus={!isAndroid}
            />
          </div>
        )}
        {allRecipes.value.length === 0 ? (
          <p class="empty small-empty">{t("assignNoRecipes")}</p>
        ) : list.length === 0 ? (
          <p class="empty small-empty">{t("noResults")}</p>
        ) : (
          <ul class="assign-list">
            {list.slice(0, 80).map((r) => (
              <li key={r.id}>
                <button
                  class="assign-row"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setQuery("");
                    await assignUnmatchedToRecipe(r.id);
                    setBusy(false);
                  }}
                >
                  <span class="assign-title">{tx(r.title)}</span>
                  <span class="assign-sub mono">{r.npName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div class="button-row end">
          <button
            class="ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setQuery("");
              await assignUnmatchedAsScenes();
              setBusy(false);
            }}
          >
            {t("useAsPreviewScene")}
          </button>
          <button class="ghost" disabled={busy} onClick={close}>
            {t("cancel")}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
