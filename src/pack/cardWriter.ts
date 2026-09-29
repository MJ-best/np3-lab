import { recipeToBytes, type Recipe } from "../np3/recipe";
import { planCardFiles, type FileNameMode, type PlannedFile } from "./naming";

/*
 * Direct read/write of a memory card through the File System Access API
 * (Chrome / Edge on macOS and Windows). Safari has no directory picker, so the
 * UI falls back to the ZIP download there.
 */

interface FsWritable {
  write(data: Uint8Array | Blob): Promise<void>;
  close(): Promise<void>;
}
interface FsFileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritable>;
}
interface FsDirHandle {
  kind: "directory";
  name: string;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDirHandle>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFileHandle>;
  values(): AsyncIterable<FsFileHandle | FsDirHandle>;
}
type PickerWindow = Window & {
  showDirectoryPicker?: (opts?: { id?: string; mode?: "read" | "readwrite"; startIn?: string }) => Promise<FsDirHandle>;
};

export const canUseCardFolder = (): boolean =>
  typeof window !== "undefined" && typeof (window as PickerWindow).showDirectoryPicker === "function";

export interface CardFolder {
  /** Handle to NIKON/CUSTOMPC (may not exist yet when opened read-only). */
  customPc: FsDirHandle | null;
  /** Human-readable location, e.g. "NIKON Z 8/NIKON/CUSTOMPC". */
  label: string;
  /** Whether the picked folder looks like a camera card (has DCIM or NIKON). */
  looksLikeCard: boolean;
}

async function childDir(dir: FsDirHandle, name: string, create: boolean): Promise<FsDirHandle | null> {
  try {
    return await dir.getDirectoryHandle(name, { create });
  } catch {
    return null;
  }
}

async function hasChild(dir: FsDirHandle, names: string[]): Promise<boolean> {
  const wanted = new Set(names.map((n) => n.toUpperCase()));
  for await (const entry of dir.values()) {
    if (entry.kind === "directory" && wanted.has(entry.name.toUpperCase())) return true;
  }
  return false;
}

/**
 * Ask the user for a folder. Accepts the card root, its NIKON folder, or
 * NIKON/CUSTOMPC itself and resolves to CUSTOMPC in every case.
 */
export async function pickCardFolder(mode: "read" | "readwrite"): Promise<CardFolder> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error("unsupported");
  const picked = await picker({ id: "nikon-card", mode });
  const create = mode === "readwrite";
  const upper = picked.name.toUpperCase();
  if (upper === "CUSTOMPC") {
    return { customPc: picked, label: `…/${picked.name}`, looksLikeCard: true };
  }
  if (upper === "NIKON") {
    return {
      customPc: await childDir(picked, "CUSTOMPC", create),
      label: `…/${picked.name}/CUSTOMPC`,
      looksLikeCard: true,
    };
  }
  const looksLikeCard = await hasChild(picked, ["DCIM", "NIKON"]);
  const nikon = await childDir(picked, "NIKON", create);
  return {
    customPc: nikon ? await childDir(nikon, "CUSTOMPC", create) : null,
    label: `${picked.name}/NIKON/CUSTOMPC`,
    looksLikeCard,
  };
}

export async function listFileNames(dir: FsDirHandle | null): Promise<string[]> {
  if (!dir) return [];
  const names: string[] = [];
  for await (const entry of dir.values()) {
    if (entry.kind === "file" && !entry.name.startsWith("._")) names.push(entry.name);
  }
  return names;
}

export interface CardWriteResult {
  written: PlannedFile[];
  overflow: Recipe[];
  existingCount: number;
}

export async function writeRecipesToCard(
  folder: CardFolder,
  recipes: readonly Recipe[],
  mode: FileNameMode,
): Promise<CardWriteResult> {
  if (!folder.customPc) throw new Error("no-folder");
  const existing = await listFileNames(folder.customPc);
  const plan = planCardFiles(recipes, { mode, existing });
  for (const f of plan.files) {
    const handle = await folder.customPc.getFileHandle(f.fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(recipeToBytes(f.recipe));
    await writable.close();
  }
  return {
    written: plan.files,
    overflow: plan.overflow,
    existingCount: existing.filter((n) => /\.NP3$/i.test(n)).length,
  };
}

export async function readNp3Files(folder: CardFolder): Promise<{ name: string; bytes: Uint8Array }[]> {
  if (!folder.customPc) return [];
  const out: { name: string; bytes: Uint8Array }[] = [];
  for await (const entry of folder.customPc.values()) {
    if (entry.kind !== "file" || !/\.NP3$/i.test(entry.name) || entry.name.startsWith("._")) continue;
    const file = await entry.getFile();
    out.push({ name: entry.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
