import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { MAX_NP3_BYTES, dateTag, exportNames, isNp3Bytes, isSafeNp3Name, looksLikeNikonCard, safeSegment, sameBytes } from "../electron/cardRules.mjs";
import type { ExportFile, ExportResult, NativeBridge, NativeCard, NativeCardFile, NativeSettings } from "./native";

/*
 * Android and iOS: the same NativeBridge the Mac app gets from electron/preload.cjs, built on
 * the SafFolders plugin (android/.../SafFoldersPlugin.java, ios/App/App/SafFoldersPlugin.swift). The SD card sits in a USB
 * reader; the user picks it once and Android keeps the permission, so it's recognised
 * again on every later insert. Card rules follow electron/main.mjs: only NIKON/CUSTOMPC
 * is read or written, names are validated, nothing is overwritten unless asked.
 */

interface SafFolder {
  uri: string;
  folderName: string;
  volumeName: string;
  available: boolean;
  freeBytes?: number;
}

interface SafEntry {
  name: string;
  isDir: boolean;
  size: number;
}

interface PathArgs {
  uri: string;
  path: string[];
}

interface SafFoldersPlugin {
  pick(opts: { kind: "card" | "export" }): Promise<Partial<SafFolder>>;
  list(opts: { kind: "card" | "export" }): Promise<{ folders: SafFolder[] }>;
  forget(opts: { uri: string }): Promise<void>;
  children(opts: PathArgs): Promise<{ exists: boolean; entries: SafEntry[] }>;
  readFile(opts: PathArgs & { name: string }): Promise<{ data: string }>;
  writeFile(opts: PathArgs & { name: string; data: string; overwrite?: boolean }): Promise<void>;
  deleteFile(opts: PathArgs & { name: string }): Promise<void>;
  saveFile(opts: { name: string; mime: string; data: string }): Promise<{ saved: boolean }>;
  addListener(event: "foldersChanged", cb: () => void): Promise<PluginListenerHandle>;
}

const Saf = registerPlugin<SafFoldersPlugin>("SafFolders");

const NP3_RE = /\.np3$/i;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(data: string): Uint8Array {
  const s = atob(data);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function names(uri: string, path: string[]): Promise<SafEntry[]> {
  const r = await Saf.children({ uri, path });
  return r.exists ? r.entries : [];
}

const findName = (entries: SafEntry[], wanted: string) => entries.find((e) => e.isDir && e.name.toUpperCase() === wanted)?.name;

/**
 * Where CUSTOMPC is, relative to the folder the user picked. They may pick the card
 * itself (usual), or its NIKON or CUSTOMPC folder. null: doesn't look like a Nikon card.
 */
async function customPcPath(folder: SafFolder): Promise<string[] | null> {
  const picked = folder.folderName.toUpperCase();
  if (picked === "CUSTOMPC") return [];
  const root = await names(folder.uri, []);
  if (picked === "NIKON") return [findName(root, "CUSTOMPC") ?? "CUSTOMPC"];
  const nikon = findName(root, "NIKON");
  if (nikon) return [nikon, findName(await names(folder.uri, [nikon]), "CUSTOMPC") ?? "CUSTOMPC"];
  const dcim = findName(root, "DCIM");
  const dcimNames = dcim ? (await names(folder.uri, [dcim])).map((e) => e.name) : null;
  if (!looksLikeNikonCard(root.map((e) => e.name), dcimNames)) return null;
  return ["NIKON", "CUSTOMPC"];
}

/** card uri → CUSTOMPC path, refreshed by every listCards(). */
const cardPaths = new Map<string, string[]>();

function requireCard(uri: string): string[] {
  const path = cardPaths.get(uri);
  if (!path) throw new Error("card-not-found");
  return path;
}

async function np3Names(uri: string, path: string[]): Promise<string[]> {
  return (await names(uri, path)).filter((e) => !e.isDir && NP3_RE.test(e.name) && !e.name.startsWith("._")).map((e) => e.name);
}

async function toCard(folder: SafFolder): Promise<NativeCard | null> {
  const path = await customPcPath(folder);
  if (!path) return null;
  cardPaths.set(folder.uri, path);
  return {
    id: folder.uri,
    name: folder.volumeName || folder.folderName || "SD",
    path: folder.uri,
    np3Count: (await np3Names(folder.uri, path)).length,
    freeBytes: folder.freeBytes ?? null,
  };
}

async function listCards(): Promise<NativeCard[]> {
  const { folders } = await Saf.list({ kind: "card" });
  const out: NativeCard[] = [];
  for (const f of folders) {
    try {
      const card = await toCard(f);
      if (card) out.push(card);
    } catch {
      /* removed while reading */
    }
  }
  return out;
}

async function writeWithoutOverwrite(uri: string, path: string[], base: string, bytes: Uint8Array, tag: string) {
  const { family, candidates } = exportNames(base, ".NP3", tag);
  const existing = (await names(uri, path)).map((e) => e.name);
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  for (const name of existing.filter((n) => family.test(n))) {
    try {
      if (sameBytes(fromBase64((await Saf.readFile({ uri, path, name })).data), bytes)) return "unchanged" as const;
    } catch {
      /* unreadable: treat as different */
    }
  }
  const data = toBase64(bytes);
  for (const name of candidates) {
    if (taken.has(name.toLowerCase())) continue;
    try {
      await Saf.writeFile({ uri, path, name, data });
      return name === candidates[0] ? ("written" as const) : ("renamed" as const);
    } catch (err) {
      if (!String((err as Error)?.message).startsWith("exists:")) throw err;
    }
  }
  throw new Error("no-free-name");
}

/** Result of picking a card folder on Android. */
export type PickCardResult = { card: NativeCard } | { cancelled: true } | { notACard: string };

export interface AndroidExtras {
  /** Ask the user for the SD card folder; remembered for later inserts. */
  pickCard(): Promise<PickCardResult>;
  /** "Save as" dialog for one file; false if cancelled. */
  saveFile(bytes: Uint8Array, fileName: string, mime: string): Promise<boolean>;
}

export function createAndroidBridge(): (NativeBridge & AndroidExtras) | undefined {
  const platform = Capacitor.getPlatform();
  if (platform !== "android" && platform !== "ios") return undefined;

  return {
    platform,
    listCards,

    async pickCard() {
      const picked = await Saf.pick({ kind: "card" });
      if (!picked.uri) return { cancelled: true };
      const folder: SafFolder = {
        uri: picked.uri,
        folderName: picked.folderName ?? "",
        volumeName: picked.volumeName ?? "",
        available: true,
        freeBytes: picked.freeBytes,
      };
      const card = await toCard(folder);
      if (!card) {
        await Saf.forget({ uri: picked.uri });
        return { notACard: folder.volumeName || folder.folderName };
      }
      changed();
      return { card };
    },

    async saveFile(bytes, fileName, mime) {
      return (await Saf.saveFile({ name: fileName, mime, data: toBase64(bytes) })).saved;
    },

    async readCard(uri): Promise<NativeCardFile[]> {
      const path = requireCard(uri);
      const out: NativeCardFile[] = [];
      for (const name of (await np3Names(uri, path)).sort()) {
        const bytes = fromBase64((await Saf.readFile({ uri, path, name })).data);
        // Skip anything dressed up as .NP3 that is far too large to be one.
        if (bytes.length <= MAX_NP3_BYTES) out.push({ fileName: name, bytes });
      }
      return out;
    },

    async writeFiles(uri, files) {
      const path = requireCard(uri);
      if (!Array.isArray(files)) throw new Error("invalid-files");
      const existing = new Set((await names(uri, path)).map((e) => e.name.toUpperCase()));
      const batch = new Set<string>();
      for (const f of files) {
        if (!isSafeNp3Name(f?.fileName)) throw new Error("invalid-file-name");
        // Whatever reaches the camera must at least look like an NP3 (same rule as the Mac app).
        if (!isNp3Bytes(f.bytes)) throw new Error("invalid-bytes");
        const key = f.fileName.toUpperCase();
        if (existing.has(key) && !f.overwrite) throw new Error(`exists:${f.fileName}`);
        if (batch.has(key)) throw new Error(`duplicate:${f.fileName}`);
        batch.add(key);
      }
      for (const f of files) {
        await Saf.writeFile({ uri, path, name: f.fileName, data: toBase64(f.bytes), overwrite: !!f.overwrite });
      }
      changed();
      return true;
    },

    // Android has no trash for SD cards: the file is deleted. The app's Undo keeps the bytes and writes them back.
    async trashFile(uri, fileName) {
      const path = requireCard(uri);
      if (!isSafeNp3Name(fileName)) throw new Error("invalid-file-name");
      await Saf.deleteFile({ uri, path, name: fileName });
      changed();
      return true;
    },

    // Apps can't unmount USB storage on Android; the card screen explains how to do it from the notification.
    async eject() {
      return true;
    },
    async reveal() {
      return false;
    },

    async chooseExportFolder() {
      const picked = await Saf.pick({ kind: "export" });
      return picked.uri ?? null;
    },

    async exportRecipes(uri, files: ExportFile[]): Promise<ExportResult> {
      const result: ExportResult = { written: 0, renamed: 0, unchanged: 0, failed: 0 };
      const tag = dateTag();
      for (const f of files.filter((f) => isNp3Bytes(f?.bytes))) {
        const path = String(f.dir).split("/").filter(Boolean).map(safeSegment);
        try {
          result[await writeWithoutOverwrite(uri, path, safeSegment(f.base), f.bytes, tag)]++;
        } catch {
          result.failed++;
        }
      }
      return result;
    },
    async revealExport() {
      return false;
    },

    // NX Studio doesn't run on Android; NP3 files are imported with the file picker instead.
    async findLocalNp3() {
      return [];
    },

    async getSettings(): Promise<NativeSettings> {
      return { openOnCard: false, openAtLogin: false, canUseLoginItem: false };
    },
    async setSettings() {
      return { openOnCard: false, openAtLogin: false, canUseLoginItem: false };
    },

    onCardsChanged(callback) {
      listeners.add(callback);
      ensureWatching();
      return () => listeners.delete(callback);
    },
  };
}

const listeners = new Set<(cards: NativeCard[]) => void>();
let lastJson = "";
let pending: Promise<void> | null = null;

/** Re-list cards and tell the page if anything changed (insert, removal, file count). */
function changed() {
  if (pending) return;
  pending = listCards()
    .then((cards) => {
      const json = JSON.stringify(cards);
      if (json === lastJson) return;
      lastJson = json;
      for (const cb of listeners) cb(cards);
    })
    .catch(() => undefined)
    .finally(() => (pending = null));
}

let watching = false;
function ensureWatching() {
  if (watching) return;
  watching = true;
  void Saf.addListener("foldersChanged", changed);
  // Poll while the app is on screen: catches card inserts and removals (USB readers send no reliable broadcasts).
  setInterval(() => {
    if (document.visibilityState === "visible") changed();
  }, 3000);
}
