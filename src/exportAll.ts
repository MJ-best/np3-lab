import JSZip from "jszip";
import { communitySourceOf, isCommunityRecipe } from "./community";
import { t } from "./i18n";
import { native, nativeErrorMessage, type ExportFile } from "./native";
import { recipeToBytes, type Recipe } from "./np3/recipe";
import { downloadBytes } from "./pack/download";
import { fileBaseFor } from "./pack/naming";
import { allRecipes, showToast } from "./state";
import { readStore, writeStore } from "./storage";

/*
 * "Export all recipes": every recipe in the library as an NP3 file, in folders by
 * origin. Folder names are fixed (not translated) so a later export finds the
 * files of an earlier one and skips those that haven't changed.
 */

const LAST_FOLDER_KEY = "exportFolder";

export function exportDirFor(r: Recipe): string {
  if (r.source !== "builtin") return "My Recipes";
  if (!isCommunityRecipe(r)) return "Built-in";
  if (communitySourceOf(r) === "serbanjpg") return "Community/SerbanJPG";
  const path = r.id.slice("community:".length);
  const dir = path.split("/").slice(0, -1).join("/");
  return dir ? `Community/${dir}` : "Community";
}

export function exportFiles(recipes: readonly Recipe[]): ExportFile[] {
  const out: ExportFile[] = [];
  for (const r of recipes) {
    try {
      out.push({ dir: exportDirFor(r), base: fileBaseFor(r), bytes: recipeToBytes(r) });
    } catch {
      /* neither params nor bytes: nothing to export */
    }
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");
const today = (d = new Date()) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

/** Browser build: one ZIP with the same layout (names made unique inside it). */
async function exportZip(files: ExportFile[]) {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const f of files) {
    let path = `NP3-Lab-Export/${f.dir}/${f.base}.NP3`;
    for (let n = 2; used.has(path.toLowerCase()); n++) path = `NP3-Lab-Export/${f.dir}/${f.base}_${today()}-${n}.NP3`;
    used.add(path.toLowerCase());
    zip.file(path, f.bytes, { binary: true });
  }
  const data = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  downloadBytes(data, `NP3-Lab-Export_${today()}.zip`, "application/zip");
  showToast(t("exportZipDone", { n: files.length }), "ok");
}

export async function exportAllRecipes(): Promise<void> {
  const files = exportFiles(allRecipes.value);
  if (files.length === 0) {
    showToast(t("exportNothing"), "warn");
    return;
  }
  if (!native) {
    await exportZip(files);
    return;
  }
  try {
    const folder = await native.chooseExportFolder(readStore<string>(LAST_FOLDER_KEY));
    if (!folder) return;
    writeStore(LAST_FOLDER_KEY, folder);
    const r = await native.exportRecipes(folder, files);
    showToast(
      t("exportDone", { written: r.written, renamed: r.renamed, unchanged: r.unchanged }) +
        (r.failed > 0 ? ` ${t("exportFailedSome", { n: r.failed })}` : ""),
      r.failed > 0 ? "warn" : "ok",
      8000,
      { label: t("revealInFinder"), run: () => void native!.revealExport(folder) },
    );
  } catch (err) {
    showToast(t("exportFailed", { msg: nativeErrorMessage(err) }), "error");
  }
}
