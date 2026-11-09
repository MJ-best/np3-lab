import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  ExportFile,
  ExportResult,
  LocalNp3File,
  NativeBridge,
  NativeCard,
  NativeCardFile,
  NativeSettings,
} from "./native";

export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
}

interface RawCard {
  id: string;
  name: string;
  path: string;
  np3_count: number;
  free_bytes: number | null;
}

interface RawCardFile {
  file_name: string;
  bytes: number[];
}

interface RawLocalNp3 {
  name: string;
  mtime_ms: number;
  bytes: number[];
}

export function createTauriBridge(): NativeBridge {
  return {
    platform: "darwin",
    async listCards(): Promise<NativeCard[]> {
      const list = await invoke<RawCard[]>("cmd_list_cards");
      return list.map((c) => ({
        id: c.id,
        name: c.name,
        path: c.path,
        np3Count: c.np3_count,
        freeBytes: c.free_bytes,
      }));
    },

    async readCard(cardPath: string): Promise<NativeCardFile[]> {
      const files = await invoke<RawCardFile[]>("cmd_read_card", { cardPath });
      return files.map((f) => ({
        fileName: f.file_name,
        bytes: new Uint8Array(f.bytes),
      }));
    },

    async writeFiles(
      cardPath: string,
      files: { fileName: string; bytes: Uint8Array; overwrite?: boolean }[],
    ): Promise<boolean> {
      const payload = files.map((f) => ({
        file_name: f.fileName,
        bytes: Array.from(f.bytes),
        overwrite: f.overwrite,
      }));
      return await invoke<boolean>("cmd_write_files", { cardPath, files: payload });
    },

    async trashFile(cardPath: string, fileName: string): Promise<boolean> {
      return await invoke<boolean>("cmd_trash_file", { cardPath, fileName });
    },

    async eject(cardPath: string): Promise<boolean> {
      return await invoke<boolean>("cmd_eject", { cardPath });
    },

    async reveal(cardPath: string): Promise<boolean> {
      return await invoke<boolean>("cmd_reveal", { cardPath });
    },

    async chooseExportFolder(defaultPath?: string): Promise<string | null> {
      return await invoke<string | null>("cmd_choose_export_folder", { defaultPath });
    },

    async exportRecipes(folder: string, files: ExportFile[]): Promise<ExportResult> {
      const payload = files.map((f) => ({
        dir: f.dir,
        base: f.base,
        bytes: Array.from(f.bytes),
      }));
      return await invoke<ExportResult>("cmd_export_recipes", { folder, files: payload });
    },

    async revealExport(folder: string): Promise<boolean> {
      return await invoke<boolean>("cmd_reveal_export", { folder });
    },

    async findLocalNp3(sinceMs?: number): Promise<LocalNp3File[]> {
      const list = await invoke<RawLocalNp3[]>("cmd_find_local_np3", { sinceMs: sinceMs ?? 0 });
      return list.map((item) => ({
        name: item.name,
        mtimeMs: item.mtime_ms,
        bytes: new Uint8Array(item.bytes),
      }));
    },

    async getSettings(): Promise<NativeSettings> {
      return await invoke<NativeSettings>("cmd_get_settings");
    },

    async setSettings(patch: Partial<Pick<NativeSettings, "openOnCard" | "openAtLogin">>): Promise<NativeSettings> {
      return await invoke<NativeSettings>("cmd_set_settings", { patch });
    },

    onCardsChanged(callback: (cards: NativeCard[]) => void): () => void {
      let unlisten: (() => void) | undefined;
      listen<RawCard[]>("cards:changed", (event) => {
        const cards: NativeCard[] = event.payload.map((c) => ({
          id: c.id,
          name: c.name,
          path: c.path,
          np3Count: c.np3_count,
          freeBytes: c.free_bytes,
        }));
        callback(cards);
      }).then((u) => {
        unlisten = u;
      });

      return () => {
        if (unlisten) unlisten();
      };
    },
  };
}
