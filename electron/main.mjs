// NP3 Lab desktop shell: watches for camera memory cards and exposes a small,
// validated file API (NIKON/CUSTOMPC only) to the renderer.
import { execFile } from "node:child_process";
import { existsSync, readFileSync, renameSync, watch, writeFileSync } from "node:fs";
import { mkdir, readdir, readFile, statfs, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { BrowserWindow, Menu, Tray, app, dialog, ipcMain, nativeImage, shell } from "electron";
import { LOGIN_FLAG, setMacLoginAgent } from "./loginItem.mjs";
import { findLocalNp3 } from "./localNp3.mjs";
import { exportRecipes } from "./exportFiles.mjs";
import { isSafeNp3Name, looksLikeNikonCard } from "./cardRules.mjs";
import { CARD_FILESYSTEMS, parseMacMounts, withTimeout } from "./volumes.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.NIKONPCLAB_DEV_URL;
const INDEX_HTML = join(here, "..", "dist", "NP3-Lab.html");
const run = promisify(execFile);

// NP3LAB_USER_DATA points a development/test run at a separate profile.
if (process.env.NP3LAB_USER_DATA) {
  app.setPath("userData", process.env.NP3LAB_USER_DATA);
} else {
  // The app used to be called "NikonPC Lab". Move its data folder (settings, My recipes)
  // to the new name once, before Electron opens it.
  const appData = app.getPath("appData");
  const userData = join(appData, "NP3 Lab");
  const legacy = join(appData, "NikonPC Lab");
  if (!existsSync(userData) && existsSync(legacy)) {
    try {
      renameSync(legacy, userData);
    } catch (err) {
      console.error("[migrate] could not move", legacy, err);
    }
  }
  app.setPath("userData", userData);
}

/** @type {BrowserWindow | null} */
let win = null;
/** @type {Tray | null} */
let tray = null;
/** @type {{ id: string, name: string, path: string, np3Count: number, freeBytes: number | null }[]} */
let cards = [];
let quitting = false;
/** Set once startup has created the window; earlier show requests are deferred. */
let started = false;
let pendingShow = false;

// ---------------------------------------------------------------------------
// Settings (userData/settings.json)

const settingsPath = () => join(app.getPath("userData"), "settings.json");
const DEFAULT_SETTINGS = { openOnCard: true, openAtLogin: true, firstRunDone: false, skipMovePrompt: false };

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(settingsPath(), "utf8")) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
let settings = DEFAULT_SETTINGS;

function saveSettings(patch) {
  settings = { ...settings, ...patch };
  try {
    writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error("[settings] save failed", err);
  }
  applyLoginItem();
  updateTray();
  return settings;
}

/** Only an installed copy may become a login item — never a dev build or a copy in Downloads. */
function canUseLoginItem() {
  if (!app.isPackaged) return false;
  return process.platform !== "darwin" || app.isInApplicationsFolder();
}

function applyLoginItem() {
  if (!canUseLoginItem()) return;
  try {
    if (process.platform === "darwin") {
      setMacLoginAgent(settings.openAtLogin, { homeDir: app.getPath("home"), execPath: process.execPath });
      // Drop a registration left by earlier versions, which used the system login-item API.
      if (app.getLoginItemSettings().openAtLogin) app.setLoginItemSettings({ openAtLogin: false });
    } else if (process.platform === "win32") {
      app.setLoginItemSettings({ openAtLogin: settings.openAtLogin, args: [LOGIN_FLAG] });
    }
  } catch (err) {
    console.error("[login item]", err);
  }
}

// ---------------------------------------------------------------------------
// Card detection

const NP3_RE = /\.np3$/i;

async function childNames(dir) {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

/** Find a child directory case-insensitively (FAT/exFAT cards may use any case). */
async function findChild(dir, wanted) {
  const names = await childNames(dir);
  return names.find((n) => n.toUpperCase() === wanted) ?? null;
}

async function isNikonCard(root) {
  const names = await childNames(root);
  const dcim = names.find((n) => n.toUpperCase() === "DCIM");
  return looksLikeNikonCard(names, dcim ? await childNames(join(root, dcim)) : null);
}

async function candidateVolumes() {
  if (process.platform === "darwin") {
    const { stdout } = await run("/sbin/mount");
    return parseMacMounts(stdout).filter((m) => CARD_FILESYSTEMS.has(m.fsType));
  }
  if (process.platform === "win32") {
    const out = [];
    for (const letter of "DEFGHIJKLMNOPQRSTUVWXYZ") {
      const path = `${letter}:\\`;
      if (existsSync(path)) out.push({ name: `${letter}:`, path });
    }
    return out;
  }
  const user = process.env.USER ?? "";
  const out = [];
  for (const base of [`/media/${user}`, `/run/media/${user}`]) {
    for (const name of await childNames(base)) out.push({ name, path: join(base, name) });
  }
  return out;
}

async function customPcDir(root, create) {
  let nikon = await findChild(root, "NIKON");
  if (!nikon) {
    if (!create) return null;
    nikon = "NIKON";
    await mkdir(join(root, nikon), { recursive: true });
  }
  let custom = await findChild(join(root, nikon), "CUSTOMPC");
  if (!custom) {
    if (!create) return null;
    custom = "CUSTOMPC";
    await mkdir(join(root, nikon, custom), { recursive: true });
  }
  return join(root, nikon, custom);
}

async function inspectVolume(v) {
  if (!(await isNikonCard(v.path))) return null;
  const dir = await customPcDir(v.path, false);
  const np3Count = dir ? (await childNames(dir)).filter((n) => NP3_RE.test(n) && !n.startsWith("._")).length : 0;
  let freeBytes = null;
  try {
    const s = await statfs(v.path);
    freeBytes = s.bavail * s.bsize;
  } catch {
    /* not available on every platform */
  }
  return { id: v.path, name: v.name, path: v.path, np3Count, freeBytes };
}

async function scanCards() {
  const found = [];
  for (const v of await candidateVolumes()) {
    // A volume that doesn't answer (failing reader, sleeping drive) must not stall detection of the others.
    const card = await withTimeout(inspectVolume(v), 4000, null);
    if (card) found.push(card);
  }
  return found;
}

let scanning = false;
async function refreshCards() {
  if (scanning) return;
  scanning = true;
  try {
    await scanAndNotify();
  } catch (err) {
    console.error("[cards] refresh failed", err);
  } finally {
    scanning = false;
  }
}

async function scanAndNotify() {
  const next = await scanCards();
  const before = new Set(cards.map((c) => c.id));
  const inserted = next.filter((c) => !before.has(c.id));
  const changed = JSON.stringify(next) !== JSON.stringify(cards);
  cards = next;
  if (changed) {
    if (win && !win.isDestroyed()) win.webContents.send("cards:changed", cards);
    updateTray();
  }
  if (inserted.length > 0 && settings.openOnCard) showWindow();
}

function startWatching() {
  if (process.platform === "darwin") {
    try {
      let timer;
      watch("/Volumes", () => {
        clearTimeout(timer);
        timer = setTimeout(refreshCards, 600);
      }).on("error", (err) => console.error("[watch] /Volumes", err));
    } catch (err) {
      console.error("[watch] /Volumes", err);
    }
  }
  // Polling as a safety net (and the only mechanism on Windows/Linux).
  setInterval(refreshCards, 3000);
  void refreshCards();
}

// ---------------------------------------------------------------------------
// IPC — every call is validated against the currently detected cards.

function requireCard(cardPath) {
  const card = cards.find((c) => c.path === cardPath);
  if (!card) throw new Error("card-not-found");
  return card;
}

function requireFileName(name) {
  if (!isSafeNp3Name(name)) throw new Error("invalid-file-name");
  return name;
}

ipcMain.handle("cards:list", async () => {
  await refreshCards();
  return cards;
});

ipcMain.handle("card:read", async (_e, cardPath) => {
  requireCard(cardPath);
  const dir = await customPcDir(cardPath, false);
  if (!dir) return [];
  const files = [];
  for (const name of (await childNames(dir)).sort()) {
    if (!NP3_RE.test(name) || name.startsWith("._")) continue;
    files.push({ fileName: name, bytes: new Uint8Array(await readFile(join(dir, name))) });
  }
  return files;
});

ipcMain.handle("card:write", async (_e, cardPath, files) => {
  requireCard(cardPath);
  if (!Array.isArray(files)) throw new Error("invalid-files");
  const dir = await customPcDir(cardPath, true);
  const existing = new Set((await childNames(dir)).map((n) => n.toUpperCase()));
  const batch = new Set();
  for (const f of files) {
    const name = requireFileName(f?.fileName);
    if (!(f.bytes instanceof Uint8Array) || f.bytes.length > 64 * 1024) throw new Error("invalid-bytes");
    if (existing.has(name.toUpperCase()) && !f.overwrite) throw new Error(`exists:${name}`);
    if (batch.has(name.toUpperCase())) throw new Error(`duplicate:${name}`);
    batch.add(name.toUpperCase());
  }
  for (const f of files) await writeFile(join(dir, f.fileName), f.bytes);
  void refreshCards();
  return true;
});

ipcMain.handle("card:trash", async (_e, cardPath, fileName) => {
  requireCard(cardPath);
  const dir = await customPcDir(cardPath, false);
  if (!dir) throw new Error("no-folder");
  await shell.trashItem(join(dir, requireFileName(fileName)));
  void refreshCards();
  return true;
});

ipcMain.handle("card:eject", async (_e, cardPath) => {
  requireCard(cardPath);
  if (process.platform === "darwin") await run("diskutil", ["eject", cardPath]);
  else throw new Error("eject-unsupported");
  await refreshCards();
  return true;
});

ipcMain.handle("card:reveal", async (_e, cardPath) => {
  requireCard(cardPath);
  const dir = await customPcDir(cardPath, false);
  await shell.openPath(dir ?? cardPath);
  return true;
});

// Export: the page may only write into folders the user picked in the dialog.
const exportFolders = new Set();

ipcMain.handle("export:choose-folder", async (_e, defaultPath) => {
  const options = {
    properties: ["openDirectory", "createDirectory"],
    defaultPath: typeof defaultPath === "string" && existsSync(defaultPath) ? defaultPath : app.getPath("pictures"),
  };
  const r = win && !win.isDestroyed() ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  if (r.canceled || !r.filePaths[0]) return null;
  exportFolders.add(r.filePaths[0]);
  return r.filePaths[0];
});

ipcMain.handle("export:write", async (_e, folder, files) => {
  if (!exportFolders.has(folder)) throw new Error("folder-not-chosen");
  if (!Array.isArray(files)) throw new Error("invalid-files");
  const valid = files.filter(
    (f) => f && typeof f.dir === "string" && typeof f.base === "string" && f.bytes instanceof Uint8Array && f.bytes.length <= 64 * 1024,
  );
  return exportRecipes(folder, valid);
});

ipcMain.handle("export:reveal", async (_e, folder) => {
  if (!exportFolders.has(folder)) throw new Error("folder-not-chosen");
  await shell.openPath(folder);
  return true;
});

// NP3 files elsewhere on this Mac (e.g. exported from NX Studio), newest first.
ipcMain.handle("np3:find-local", async (_e, sinceMs) =>
  findLocalNp3({ sinceMs: Number.isFinite(sinceMs) ? sinceMs : 0, exclude: [app.getPath("userData")] }),
);

ipcMain.handle("settings:get", () => ({ ...settings, canUseLoginItem: canUseLoginItem() }));
ipcMain.handle("settings:set", (_e, patch) => {
  const allowed = {};
  for (const k of ["openOnCard", "openAtLogin"]) if (typeof patch?.[k] === "boolean") allowed[k] = patch[k];
  return { ...saveSettings(allowed), canUseLoginItem: canUseLoginItem() };
});

// ---------------------------------------------------------------------------
// Window & tray

function showWindow() {
  if (!started) {
    pendingShow = true;
    return;
  }
  if (!win || win.isDestroyed()) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  if (process.platform === "darwin") app.dock?.show();
}

function createWindow(showOnReady = true) {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    show: false,
    backgroundColor: "#000000",
    title: "NP3 Lab",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 18 },
    webPreferences: {
      preload: join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (showOnReady) win.once("ready-to-show", () => win?.show());

  // Links (e.g. "View original" on Reddit recipes) open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (url !== win?.webContents.getURL()) e.preventDefault();
  });

  // If the window does get destroyed, a new one is created the next time it's needed.
  win.on("closed", () => {
    win = null;
  });

  // Closing the window keeps the app waiting for cards in the menu bar.
  win.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    win?.hide();
    if (process.platform === "darwin") app.dock?.hide();
  });

  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(INDEX_HTML);
}

function trayImage() {
  const img = nativeImage.createFromPath(join(here, "assets", "trayTemplate.png"));
  img.setTemplateImage(true);
  return img;
}

function updateTray() {
  if (!tray) return;
  const cardItems =
    cards.length === 0
      ? [{ label: "카드 없음 / No card", enabled: false }]
      : cards.map((c) => ({ label: `💾 ${c.name} — NP3 ${c.np3Count}`, click: showWindow }));
  tray.setToolTip(cards.length ? `NP3 Lab — ${cards.map((c) => c.name).join(", ")}` : "NP3 Lab");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "NP3 Lab 열기 / Open", click: showWindow },
      { type: "separator" },
      ...cardItems,
      { type: "separator" },
      {
        label: "카드를 꽂으면 창 열기 / Open when a card is inserted",
        type: "checkbox",
        checked: settings.openOnCard,
        click: (item) => saveSettings({ openOnCard: item.checked }),
      },
      {
        label: "로그인 시 자동 실행 / Open at login",
        type: "checkbox",
        checked: settings.openAtLogin,
        enabled: canUseLoginItem(),
        click: (item) => saveSettings({ openAtLogin: item.checked }),
      },
      { type: "separator" },
      { label: "종료 / Quit", role: "quit" },
    ]),
  );
}

/** Offer to move a copy opened from the DMG or Downloads into /Applications (it relaunches from there). */
async function offerMoveToApplications() {
  if (process.platform !== "darwin" || !app.isPackaged || app.isInApplicationsFolder() || settings.skipMovePrompt) return;
  const ko = app.getLocale().startsWith("ko");
  const { response, checkboxChecked } = await dialog.showMessageBox({
    type: "question",
    buttons: ko ? ["응용 프로그램 폴더로 옮기기", "나중에"] : ["Move to Applications", "Not now"],
    defaultId: 0,
    cancelId: 1,
    message: ko ? "NP3 Lab을 응용 프로그램 폴더로 옮길까요?" : "Move NP3 Lab to the Applications folder?",
    detail: ko
      ? "옮기면 로그인할 때 자동으로 실행되어 SD카드를 꽂기만 하면 바로 열립니다."
      : "Once installed there it can start at login and open whenever you insert an SD card.",
    checkboxLabel: ko ? "다시 묻지 않기" : "Don't ask again",
  });
  if (response === 0) {
    try {
      app.moveToApplicationsFolder();
    } catch (err) {
      dialog.showErrorBox("NP3 Lab", String(err?.message ?? err));
    }
  } else if (checkboxChecked) {
    saveSettings({ skipMovePrompt: true });
  }
}

// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", showWindow);
  app.on("before-quit", () => (quitting = true));
  app.on("activate", showWindow);

  app.whenReady().then(async () => {
    settings = loadSettings();
    await offerMoveToApplications();
    if (!settings.firstRunDone) saveSettings({ firstRunDone: true });
    else applyLoginItem();

    tray = new Tray(trayImage());
    updateTray();

    // Started by the login item: wait quietly in the menu bar until a card shows up.
    const login = process.argv.includes(LOGIN_FLAG) && !pendingShow;
    if (!win || win.isDestroyed()) createWindow(!login);
    if (login && process.platform === "darwin") app.dock?.hide();
    started = true;
    if (pendingShow) showWindow();
    startWatching();
  });

  // Keep running with no windows; quit only from the tray or ⌘Q.
  app.on("window-all-closed", () => {});
}
