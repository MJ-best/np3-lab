import { useMemo, useRef, useState } from "preact/hooks";
import { t, tagLabel, tx } from "../i18n";
import { isDesktop } from "../native";
import { canUseCardFolder } from "../pack/cardWriter";
import { downloadText } from "../pack/download";
import {
  activeSample,
  allRecipes,
  exportBackup,
  importBackup,
  openImport,
  pasteOpen,
  resetDraft,
  route,
  showToast,
} from "../state";
import { communityInfo } from "../community";
import { lookOf } from "../look";
import { importFromThisMac } from "../localNp3";
import { exportAllRecipes } from "../exportAll";
import { photosByRecipe } from "../photos";
import { CommunityPanel } from "./CommunityPanel";
import { usePreparedSample } from "./hooks";
import { np3FromCard, np3FromFiles } from "./ImportDialog";
import { RecipeCard } from "./RecipeCard";
import { SceneChips } from "./SceneChips";

type Filter = "all" | "photos" | "mine" | "reddit" | "imaging-cloud" | `tag:${string}`;

export function Gallery() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const np3Input = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const source = usePreparedSample(activeSample.value);
  const recipes = allRecipes.value;

  const tags = useMemo(() => [...new Set(recipes.flatMap((r) => r.tags))], [recipes]);
  const hasMine = recipes.some((r) => r.source !== "builtin");
  const hasReddit = recipes.some((r) => r.origin?.kind === "reddit");
  const hasCloud = recipes.some((r) => r.origin?.kind === "imaging-cloud");

  const visible = recipes.filter((r) => {
    if (filter === "photos" && !photosByRecipe.value[r.id]?.length) return false;
    if (filter === "mine" && r.source === "builtin") return false;
    if ((filter === "reddit" || filter === "imaging-cloud") && r.origin?.kind !== filter) return false;
    if (filter.startsWith("tag:") && !r.tags.includes(filter.slice(4))) return false;
    if (!query.trim()) return true;
    const look = r.params ? lookOf(r.params, r.tags.includes("mono")).summary : undefined;
    const hay = [tx(r.title), r.npName, r.author, ...r.tags.map(tagLabel), tx(r.description), tx(r.use), look?.ko, look?.en]
      .join(" ")
      .toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  const importFromCard = async () => {
    const files = await np3FromCard();
    if (files && files.length > 0) openImport("file", files);
  };

  return (
    <div class="gallery">
      <div class="toolbar">
        <input class="search" type="search" placeholder={t("search")} value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
        <div class="toolbar-actions">
          <details class="menu" ref={menuRef}>
            <summary>{t("importMore")} ▾</summary>
            <div class="menu-list" onClick={() => menuRef.current?.removeAttribute("open")}>
              <button onClick={() => (pasteOpen.value = true)}>{t("pasteText")}</button>
              <button onClick={() => openImport("imaging-cloud")}>{t("importCloud")}</button>
              {isDesktop && <button onClick={() => void importFromThisMac()}>{t("localNp3Search")}</button>}
              <button onClick={() => np3Input.current?.click()}>{t("importNp3")}</button>
              {!isDesktop && canUseCardFolder() && <button onClick={importFromCard}>{t("importFromCard")}</button>}
            </div>
          </details>
          <button
            class="primary"
            onClick={() => {
              resetDraft();
              route.value = "editor";
            }}
          >
            ＋ {t("newRecipe")}
          </button>
        </div>
        <input
          ref={np3Input}
          type="file"
          accept=".np3,.NP3"
          multiple
          hidden
          onChange={async (e) => {
            const input = e.currentTarget;
            const files = await np3FromFiles(Array.from(input.files ?? []));
            input.value = "";
            if (files.length > 0) openImport("file", files);
          }}
        />
      </div>

      {!communityInfo.value && <CommunityPanel />}

      <div class="chips filters">
        <button class={`chip${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
          {t("filterAll")}
        </button>
        {hasMine && (
          <button class={`chip${filter === "mine" ? " active" : ""}`} onClick={() => setFilter("mine")}>
            {t("filterMine")}
          </button>
        )}
        {hasReddit && (
          <button class={`chip${filter === "reddit" ? " active" : ""}`} onClick={() => setFilter("reddit")}>
            {t("filterReddit")}
          </button>
        )}
        {Object.keys(photosByRecipe.value).length > 0 && (
          <button class={`chip${filter === "photos" ? " active" : ""}`} onClick={() => setFilter("photos")}>
            📷 {t("filterPhotos")}
          </button>
        )}
        {hasCloud && (
          <button class={`chip${filter === "imaging-cloud" ? " active" : ""}`} onClick={() => setFilter("imaging-cloud")}>
            {t("filterCloud")}
          </button>
        )}
        {tags.filter((tag) => tag !== "reddit").map((tag) => (
          <button key={tag} class={`chip${filter === `tag:${tag}` ? " active" : ""}`} onClick={() => setFilter(`tag:${tag}`)}>
            {tagLabel(tag)}
          </button>
        ))}
      </div>

      <div class="scene-row">
        <span class="label">{t("scene")}</span>
        <SceneChips showHint />
      </div>

      {visible.length === 0 ? (
        <p class="empty">{recipes.length === 0 ? t("libraryEmpty") : t("noResults")}</p>
      ) : (
        <div class="grid">
          {visible.map((r) => (
            <RecipeCard key={r.id} recipe={r} source={source} />
          ))}
        </div>
      )}

      {communityInfo.value && <CommunityPanel />}

      <div class="backup-row">
        <button class="link" onClick={() => void exportAllRecipes()}>
          {t("exportAll")}
        </button>
        <span aria-hidden="true">·</span>
        <button class="link" onClick={() => downloadText(exportBackup(), "np3-lab-backup.json")}>
          {t("backupExport")}
        </button>
        <span aria-hidden="true">·</span>
        <button class="link" onClick={() => backupInput.current?.click()}>
          {t("backupImport")}
        </button>
        <input
          ref={backupInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const input = e.currentTarget;
            const file = input.files?.[0];
            input.value = "";
            if (!file) return;
            try {
              showToast(t("backupRestored", { n: importBackup(await file.text()) }), "ok");
            } catch {
              showToast(t("backupInvalid"), "error");
            }
          }}
        />
      </div>
    </div>
  );
}
