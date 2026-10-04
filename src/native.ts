import { createAndroidBridge, type AndroidExtras } from "./androidBridge";

/** Card as reported by the desktop app's main process. */
export interface NativeCard {
  id: string;
  /** Volume name, e.g. "NIKON Z 8". */
  name: string;
  path: string;
  np3Count: number;
  freeBytes: number | null;
}

export interface NativeCardFile {
  fileName: string;
  bytes: Uint8Array;
}

export interface ExportFile {
  /** Relative folder, e.g. "Community/Nikon Creators". */
  dir: string;
  /** File name without extension. */
  base: string;
  bytes: Uint8Array;
}

export interface ExportResult {
  written: number;
  /** Saved with the date appended because a different file had the name. */
  renamed: number;
  /** Already exported with the same contents. */
  unchanged: number;
  failed: number;
}

/** An NP3 file found elsewhere on the computer (e.g. exported from NX Studio). */
export interface LocalNp3File {
  name: string;
  mtimeMs: number;
  bytes: Uint8Array;
}

export interface NativeSettings {
  openOnCard: boolean;
  openAtLogin: boolean;
  /** False for dev builds and copies outside /Applications. */
  canUseLoginItem: boolean;
}

/** API injected by electron/preload.cjs. Absent in the browser build. */
export interface NativeBridge {
  platform: string;
  listCards(): Promise<NativeCard[]>;
  readCard(cardPath: string): Promise<NativeCardFile[]>;
  writeFiles(cardPath: string, files: { fileName: string; bytes: Uint8Array; overwrite?: boolean }[]): Promise<boolean>;
  trashFile(cardPath: string, fileName: string): Promise<boolean>;
  eject(cardPath: string): Promise<boolean>;
  reveal(cardPath: string): Promise<boolean>;
  /** Folder picker for exports; null if cancelled. Only chosen folders can be written. */
  chooseExportFolder(defaultPath?: string): Promise<string | null>;
  /** Write recipes under `folder`, never overwriting; unchanged files are skipped. */
  exportRecipes(folder: string, files: ExportFile[]): Promise<ExportResult>;
  revealExport(folder: string): Promise<boolean>;
  /** NP3 files on this computer, newest first; only those modified after `sinceMs` if given. */
  findLocalNp3(sinceMs?: number): Promise<LocalNp3File[]>;
  getSettings(): Promise<NativeSettings>;
  setSettings(patch: Partial<Pick<NativeSettings, "openOnCard" | "openAtLogin">>): Promise<NativeSettings>;
  onCardsChanged(callback: (cards: NativeCard[]) => void): () => void;
}

/** Mac app: injected by electron/preload.cjs. Android app: built on the SafFolders plugin. */
const android = typeof window !== "undefined" ? createAndroidBridge() : undefined;

export const native: NativeBridge | undefined =
  typeof window !== "undefined" ? ((window as Window & { nikonPcLab?: NativeBridge }).nikonPcLab ?? android) : undefined;

/** The app (Mac or Android), as opposed to the browser build. */
export const isDesktop = native !== undefined;

/** Android-only additions (picking the card folder); undefined elsewhere. */
export const androidNative: AndroidExtras | undefined = android;
/** The phone/tablet app (Android or iOS): same card bridge and touch UI. */
export const isAndroid = android !== undefined;
/** iOS only, for wording that differs from Android (Files picker, no eject). */
export const isIos = android?.platform === "ios";

/** Turn "Error invoking remote method 'card:write': Error: exists:X" into "exists:X". */
export function nativeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");
}
