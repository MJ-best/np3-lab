import JSZip from "jszip";
import { recipeToBytes, type Recipe } from "../np3/recipe";
import { CARD_DIR, MAX_PER_CARD, chunk, manifestText, planCardFiles, type FileNameMode, type PlannedFile } from "./naming";

export interface ZipResult {
  data: Uint8Array;
  cards: PlannedFile[][];
}

/**
 * Build a ZIP whose layout mirrors the memory card:
 *   NIKON/CUSTOMPC/PICCON01.NP3 ...   (≤ 99 recipes)
 *   CARD-1/NIKON/CUSTOMPC/..., CARD-2/...   (> 99 recipes, one folder per card)
 */
export async function buildZip(
  recipes: readonly Recipe[],
  opts: { mode: FileNameMode; startAt?: number; date?: Date },
): Promise<ZipResult> {
  const zip = new JSZip();
  const date = opts.date ?? new Date();
  const groups = chunk(recipes, MAX_PER_CARD);
  const cards = groups.map((group) => planCardFiles(group, { mode: opts.mode, startAt: opts.startAt }).files);
  cards.forEach((files, i) => {
    const prefix = cards.length > 1 ? `CARD-${i + 1}/` : "";
    for (const f of files) {
      zip.file(`${prefix}${CARD_DIR}/${f.fileName}`, recipeToBytes(f.recipe), { date, binary: true });
    }
  });
  zip.file("LIST.txt", manifestText(cards, date), { date });
  const data = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  return { data, cards };
}

export function zipFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `NP3-Lab_${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.zip`;
}
