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
  getSettings(): Promise<NativeSettings>;
  setSettings(patch: Partial<Pick<NativeSettings, "openOnCard" | "openAtLogin">>): Promise<NativeSettings>;
  onCardsChanged(callback: (cards: NativeCard[]) => void): () => void;
}

export const native: NativeBridge | undefined =
  typeof window !== "undefined" ? (window as Window & { nikonPcLab?: NativeBridge }).nikonPcLab : undefined;

export const isDesktop = native !== undefined;

/** Turn "Error invoking remote method 'card:write': Error: exists:X" into "exists:X". */
export function nativeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");
}
