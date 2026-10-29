import { useEffect, useState } from "preact/hooks";
import { account, accountsEnabled, guest, showLanding, startAccount } from "./account";
import { handleAndroidBack } from "./androidBack";
import { activeCard, startCardSync } from "./cards";
import { lang, t, type MessageKey } from "./i18n";
import { isAndroid, isDesktop, native } from "./native";
import { webglAvailable } from "./render/renderer";
import { loadPhotoIndex } from "./photos";
import { importPhotos } from "./photoImport";
import { checkForNewLocalNp3 } from "./localNp3";
import { builtinsReady, cartRecipes, dismissToast, importSession, openImport, route, toasts, type Route } from "./state";
import { Cart } from "./ui/Cart";
import { CardView } from "./ui/CardView";
import { Editor } from "./ui/Editor";
import { Gallery } from "./ui/Gallery";
import { ImportDialog, np3FromFiles } from "./ui/ImportDialog";
import { Landing } from "./ui/Landing";
import { Logo } from "./ui/Logo";
import { PhotoGallery } from "./ui/PhotoGallery";
import { RecipeDetail } from "./ui/RecipeDetail";
import { SettingsDialog } from "./ui/SettingsDialog";
import { TextImportDialog } from "./ui/TextImportDialog";

// The desktop app is card-first; the browser build keeps the basket + ZIP flow.
const TABS: { id: Route; key: MessageKey }[] = isDesktop
  ? [
      { id: "card", key: "tabCard" },
      { id: "gallery", key: "tabLibrary" },
      { id: "photos", key: "tabPhotos" },
      { id: "editor", key: "tabEditor" },
    ]
  : [
      { id: "gallery", key: "tabLibrary" },
      { id: "photos", key: "tabPhotos" },
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
      // Photos go to the recipe in their EXIF; the rest become preview scenes.
      await importPhotos(files);
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
    startAccount();
    if (isDesktop) {
      document.documentElement.classList.add("desktop");
      if (isAndroid) document.documentElement.classList.add(native!.platform);
      startCardSync();
      if (isAndroid) {
        handleAndroidBack();
        return;
      }
      // NP3 files exported from NX Studio (or saved anywhere) since we last looked.
      void builtinsReady.then(checkForNewLocalNp3);
      const onFocus = () => void checkForNewLocalNp3();
      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    }
  }, []);
  useEffect(() => window.scrollTo(0, 0), [route.value]);

  // accountsEnabled first: a constant, so the other builds leave the sign-up page out.
  if (accountsEnabled && showLanding.value)
    return (
      <div class="app">
        <Landing />
        <Toasts />
      </div>
    );

  return (
    <div class="app">
      <header class="topbar">
        <div class="brand">
          <Logo />
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
              {tab.id === "card" && !isDesktop && cartRecipes.value.length > 0 && <span class="count">{cartRecipes.value.length}</span>}
              {tab.id === "card" && isDesktop && activeCard.value && <span class="count">{activeCard.value.np3Count}</span>}
            </button>
          ))}
        </nav>
        <div class="topbar-actions">
          {accountsEnabled && !account.value && (
            <button class="lang" onClick={() => (guest.value = false)}>
              {t("signIn")}
            </button>
          )}
          <button class="lang" aria-label={t("settingsTitle")} title={t("settingsTitle")} onClick={() => setSettingsOpen(true)}>
            ⚙︎
          </button>
        </div>
      </header>

      {!gl && <div class="banner warn">{t("noWebgl")}</div>}

      <main class="content">
        {route.value === "gallery" && <Gallery />}
        {route.value === "photos" && <PhotoGallery />}
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
      <Toasts />
    </div>
  );
}

function Toasts() {
  return (
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
  );
}
