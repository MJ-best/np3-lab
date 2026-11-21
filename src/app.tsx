import { useEffect, useState } from "preact/hooks";
import { account, accountsEnabled, guest, showLanding, startAccount } from "./account";
import { watchPro } from "./pro";
import { openSharedFromUrl } from "./share";
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
import { ProDialog } from "./ui/ProDialog";
import { RecipeDetail } from "./ui/RecipeDetail";
import { SettingsDialog } from "./ui/SettingsDialog";
import { TextImportDialog } from "./ui/TextImportDialog";
import { useMediaQuery } from "./ui/hooks";

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

function TabIcon({ id }: { id: Route }) {
  if (id === "card") {
    return (
      <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
        <path d="M7 3h7l5 5v12a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V4.5A1.5 1.5 0 0 1 7 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M9.5 3v4M12.5 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>
    );
  }
  if (id === "gallery") {
    return (
      <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8" />
      </svg>
    );
  }
  if (id === "photos") {
    return (
      <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8" />
        <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" />
        <path d="M4 17l5-4.5 3.5 3 3-2.5L20 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="9" cy="7" r="2.2" fill="var(--bg)" stroke="currentColor" stroke-width="1.8" />
      <circle cx="15.5" cy="12" r="2.2" fill="var(--bg)" stroke="currentColor" stroke-width="1.8" />
      <circle cx="10.5" cy="17" r="2.2" fill="var(--bg)" stroke="currentColor" stroke-width="1.8" />
    </svg>
  );
}

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
  const mobileNav = useMediaQuery("(max-width: 760px)");
  useEffect(() => {
    document.documentElement.lang = lang.value;
    void loadPhotoIndex();
    startAccount();
    // Hosted web version: Pro status, and recipes shared by link (?share=…).
    watchPro();
    void openSharedFromUrl();
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

  const cardBadge =
    !isDesktop && cartRecipes.value.length > 0
      ? cartRecipes.value.length
      : isDesktop && activeCard.value
        ? activeCard.value.np3Count
        : null;

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
        {!mobileNav && (
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
                {tab.id === "card" && cardBadge !== null && <span class="count">{cardBadge}</span>}
              </button>
            ))}
          </nav>
        )}
        <div class="topbar-actions">
          {accountsEnabled && !account.value && (
            <button class="lang" onClick={() => (guest.value = false)}>
              {t("signIn")}
            </button>
          )}
          <button class="lang settings-btn" aria-label={t("settingsTitle")} title={t("settingsTitle")} onClick={() => setSettingsOpen(true)}>
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

      {mobileNav && (
        <nav class="bottom-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={route.value === tab.id}
              class={`bottom-tab${route.value === tab.id ? " active" : ""}`}
              onClick={() => (route.value = tab.id)}
            >
              <span class="bottom-tab-icon">
                <TabIcon id={tab.id} />
                {tab.id === "card" && cardBadge !== null && <span class="count">{cardBadge}</span>}
              </span>
              <span class="bottom-tab-label">{t(tab.key)}</span>
            </button>
          ))}
        </nav>
      )}

      <RecipeDetail />
      {accountsEnabled && <ProDialog />}
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
