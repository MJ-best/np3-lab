import { useEffect, useState } from "preact/hooks";
import { activeCard, startCardSync } from "./cards";
import { lang, setLang, t, type MessageKey, LANGS, type Lang } from "./i18n";
import { isDesktop } from "./native";
import { webglAvailable } from "./render/renderer";
import { addPhotos, loadPhotoIndex, matchRecipeByExif } from "./photos";
import { checkForNewLocalNp3 } from "./localNp3";
import { addUserPhoto, allRecipes, builtinsReady, cart, dismissToast, importSession, openImport, route, showToast, toasts, type Route } from "./state";
import { Cart } from "./ui/Cart";
import { CardView } from "./ui/CardView";
import { Editor } from "./ui/Editor";
import { Gallery } from "./ui/Gallery";
import { ImportDialog, np3FromFiles } from "./ui/ImportDialog";
import { RecipeDetail } from "./ui/RecipeDetail";
import { SettingsDialog } from "./ui/SettingsDialog";
import { TextImportDialog } from "./ui/TextImportDialog";

// The desktop app is card-first; the browser build keeps the basket + ZIP flow.
const TABS: { id: Route; key: MessageKey }[] = isDesktop
  ? [
      { id: "card", key: "tabCard" },
      { id: "gallery", key: "tabLibrary" },
      { id: "editor", key: "tabEditor" },
    ]
  : [
      { id: "gallery", key: "tabGallery" },
      { id: "editor", key: "tabEditor" },
      { id: "card", key: "tabCard" },
    ];

/** Accept NP3 files and photos dropped anywhere on the window. */
function useWindowDrop() {
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const overFn = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      const np3 = await np3FromFiles(files);
      if (np3.length > 0) openImport(importSession.value?.mode ?? "file", np3);
      const images = files.filter((f) => f.type.startsWith("image/"));
      const unmatched: File[] = [];
      const matched = new Map<string, File[]>();
      for (const f of images) {
        const recipe = await matchRecipeByExif(f, allRecipes.value);
        if (recipe) matched.set(recipe.id, [...(matched.get(recipe.id) ?? []), f]);
        else unmatched.push(f);
      }
      let filed = 0;
      for (const [id, list] of matched) filed += await addPhotos(id, list);
      if (filed > 0) showToast(t("photosFiled", { n: filed, m: matched.size }), "ok", 6000);
      // Anything we can't place becomes a preview scene, as before.
      for (const f of unmatched) await addUserPhoto(f);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overFn);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overFn);
      window.removeEventListener("drop", drop);
    };
  }, []);
  return over;
}

export function App() {
  const dropping = useWindowDrop();
  const [gl] = useState(() => webglAvailable());
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    document.documentElement.lang = lang.value;
    void loadPhotoIndex();
    if (isDesktop) {
      document.documentElement.classList.add("desktop");
      startCardSync();
      // NP3 files exported from NX Studio (or saved anywhere) since we last looked.
      void builtinsReady.then(checkForNewLocalNp3);
      const onFocus = () => void checkForNewLocalNp3();
      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    }
  }, []);
  useEffect(() => window.scrollTo(0, 0), [route.value]);

  return (
    <div class="app">
      <header class="topbar">
        <div class="brand">
          {/* Same artwork as the app icon (scripts/make-icons.mjs). */}
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <rect width="32" height="32" rx="7.2" fill="#F2EEE4" />
            <path d="M12.9 8.5h8.2l2.3 4.6H10.6z" fill="#161616" />
            <rect x="6.3" y="11" width="4.3" height="2.2" rx=".6" fill="#161616" />
            <rect x="22.9" y="11" width="4.3" height="2.2" rx=".6" fill="#161616" />
            <rect x="3.6" y="12.4" width="24.8" height="13.2" rx="2.5" fill="#161616" />
            <rect x="7.2" y="15.5" width=".5" height="7.8" rx=".25" fill="#D22C24" />
            <circle cx="16.9" cy="19" r="4.7" fill="#0a0a0a" stroke="#F4F4F0" strokeWidth=".7" />
          </svg>
          <div>
            <strong>NP3 Lab</strong>
            <span class="tagline">{t("appTagline")}</span>
          </div>
        </div>
        <nav class="tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={route.value === tab.id}
              class={route.value === tab.id ? "active" : ""}
              onClick={() => (route.value = tab.id)}
            >
              {t(tab.key)}
              {tab.id === "card" && !isDesktop && cart.value.length > 0 && <span class="count">{cart.value.length}</span>}
              {tab.id === "card" && isDesktop && activeCard.value && <span class="count">{activeCard.value.np3Count}</span>}
            </button>
          ))}
        </nav>
        <div class="topbar-actions">
          <select class="lang" aria-label="Language" value={lang.value} onChange={(e) => setLang(e.currentTarget.value as Lang)}>
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          {isDesktop && (
            <button class="lang" aria-label={t("settingsTitle")} title={t("settingsTitle")} onClick={() => setSettingsOpen(true)}>
              ⚙︎
            </button>
          )}
        </div>
      </header>

      {!gl && <div class="banner warn">{t("noWebgl")}</div>}

      <main class="content">
        {route.value === "gallery" && <Gallery />}
        {route.value === "editor" && <Editor />}
        {route.value === "card" && (isDesktop ? <CardView /> : <Cart />)}
      </main>

      <footer class="footer">
        <span>{t("unofficial")}</span>
        <span>{t("credits")}</span>
      </footer>

      <RecipeDetail />
      <TextImportDialog />
      <ImportDialog />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}

      {dropping && (
        <div class="drop-overlay">
          <div>{t("dropHint")}</div>
        </div>
      )}
      <div class="toasts" aria-live="polite">
        {toasts.value.map((toast) => (
          <div key={toast.id} class={`toast ${toast.kind}`}>
            {toast.text}
            {toast.action && (
              <button
                class="toast-action"
                onClick={() => {
                  toast.action!.run();
                  dismissToast(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
