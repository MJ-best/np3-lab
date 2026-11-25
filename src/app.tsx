import { useEffect, useState } from "preact/hooks";
import { account, accountsEnabled, guest, showLanding, startAccount } from "./account";
import { watchPro } from "./pro";
import { openSharedFromUrl } from "./share";
import { handleAndroidBack } from "./androidBack";
import { activeCard, startCardSync } from "./cards";
import { lang, t, type MessageKey } from "./i18n";
import { haptic, isAndroid, isDesktop, native } from "./native";
import { isValidNpName } from "./np3/recipe";
import { webglAvailable } from "./render/renderer";
import { loadPhotoIndex } from "./photos";
import { importPhotos } from "./photoImport";
import { checkForNewLocalNp3 } from "./localNp3";
import {
  builtinsReady,
  cartRecipes,
  closeEditor,
  dismissToast,
  draft,
  importSession,
  openImport,
  openNewEditor,
  route,
  saveDraft,
  toasts,
  type MainTab,
} from "./state";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Editor } from "./ui/Editor";
import { Gallery } from "./ui/Gallery";
import { HomeView } from "./ui/HomeView";
import { IconPlus } from "./ui/Icons";
import { ImportDialog, np3FromFiles } from "./ui/ImportDialog";
import { Landing } from "./ui/Landing";
import { Logo } from "./ui/Logo";
import { Onboarding } from "./ui/Onboarding";
import { PhotoAssignDialog } from "./ui/PhotoAssignDialog";
import { PhotoGallery } from "./ui/PhotoGallery";
import { ProDialog } from "./ui/ProDialog";
import { RecipeDetail } from "./ui/RecipeDetail";
import { SettingsDialog } from "./ui/SettingsDialog";
import { TextImportDialog } from "./ui/TextImportDialog";
import { useMediaQuery } from "./ui/hooks";

// Unified 3-tab structure across all platforms; Editor opens as a dedicated sub-screen.
const TABS: { id: MainTab; key: MessageKey }[] = [
  { id: "home", key: "tabHome" },
  { id: "gallery", key: "tabLibrary" },
  { id: "photos", key: "tabPhotos" },
];

function TabIcon({ id }: { id: MainTab }) {
  if (id === "home") {
    return (
      <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
        <path
          d="M3.5 10.5L12 3.5l8.5 7v9A1.5 1.5 0 0 1 19 21h-4.5v-6h-5v6H5a1.5 1.5 0 0 1-1.5-1.5v-9z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"
        />
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
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8" />
      <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" />
      <path d="M4 17l5-4.5 3.5 3 3-2.5L20 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
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

  const switchTab = (id: MainTab) => {
    if (route.value !== id) haptic("selection");
    route.value = id;
  };

  const inEditor = route.value === "editor";
  const d = draft.value;
  const canSaveDraft = isValidNpName(d.npName);

  return (
    <div class={`app${inEditor ? " in-editor" : ""}`}>
      {inEditor ? (
        <header class="topbar editor-topbar">
          <button
            class="ghost editor-back-btn"
            onClick={() => {
              haptic("light");
              void closeEditor();
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{t("back")}</span>
          </button>
          <div class="editor-topbar-title">
            <strong>{d.title.trim() || t("newRecipe")}</strong>
            {d.dirty && <span class="dirty-dot" aria-label={t("unsaved")} />}
          </div>
          <div class="topbar-actions">
            <button
              class={`small-btn${d.dirty || !d.editingId ? " primary" : ""}`}
              disabled={!canSaveDraft}
              onClick={() => {
                if (d.dirty || !d.editingId) saveDraft();
              }}
            >
              {d.dirty || !d.editingId ? t("saveShort") : `✓ ${t("saveShort")}`}
            </button>
          </div>
        </header>
      ) : (
        <header class={`topbar${mobileNav ? " mobile-topbar" : ""}`}>
          {mobileNav ? (
            <div class="mobile-header-title">
              {route.value === "home" && <Logo />}
              <h1>{route.value === "home" ? "NP3 Lab" : route.value === "gallery" ? t("tabLibrary") : t("tabPhotos")}</h1>
            </div>
          ) : (
            <div class="brand">
              <Logo />
              <div>
                <strong>NP3 Lab</strong>
                <span class="tagline">{t("appTagline")}</span>
              </div>
            </div>
          )}
          {!mobileNav && (
            <nav class="tabs" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={route.value === tab.id}
                  class={route.value === tab.id ? "active" : ""}
                  onClick={() => switchTab(tab.id)}
                >
                  {t(tab.key)}
                  {tab.id === "home" && cardBadge !== null && <span class="count">{cardBadge}</span>}
                </button>
              ))}
            </nav>
          )}
          <div class="topbar-actions">
            {mobileNav && route.value === "gallery" && (
              <button
                class="header-action-btn primary"
                aria-label={t("newRecipe")}
                title={t("newRecipe")}
                onClick={() => {
                  haptic("light");
                  openNewEditor();
                }}
              >
                <IconPlus size={18} />
              </button>
            )}
            {accountsEnabled && !account.value && (
              <button class="lang" onClick={() => (guest.value = false)}>
                {t("signIn")}
              </button>
            )}
            <button class="settings-btn" aria-label={t("settingsTitle")} title={t("settingsTitle")} onClick={() => setSettingsOpen(true)}>
              <SettingsIcon />
            </button>
          </div>
        </header>
      )}

      {!gl && <div class="banner warn">{t("noWebgl")}</div>}

      <main class="content">
        {route.value === "home" && <HomeView />}
        {route.value === "gallery" && <Gallery />}
        {route.value === "photos" && <PhotoGallery />}
        {route.value === "editor" && <Editor />}
      </main>

      {!isAndroid && !inEditor && (
        <footer class="footer">
          <span>{t("unofficial")}</span>
          <span>{t("credits")}</span>
        </footer>
      )}

      {mobileNav && !inEditor && (
        <nav class="bottom-tabs" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={route.value === tab.id}
              class={`bottom-tab${route.value === tab.id ? " active" : ""}`}
              onClick={() => switchTab(tab.id)}
            >
              <span class="bottom-tab-icon">
                <TabIcon id={tab.id} />
                {tab.id === "home" && cardBadge !== null && <span class="count">{cardBadge}</span>}
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
      <PhotoAssignDialog />
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      <Onboarding />
      <ConfirmDialog />

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
