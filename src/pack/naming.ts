import { sanitizeNpName, type LocalizedText, type Recipe } from "../np3/recipe";

/** Nikon reads at most 99 files of each picture-control type per card (01–99). */
export const MAX_PER_CARD = 99;
export const CARD_DIR = "NIKON/CUSTOMPC";

export type FileNameMode = "piccon" | "name";

export interface PlannedFile {
  fileName: string;
  recipe: Recipe;
}

export interface PackPlan {
  files: PlannedFile[];
  /** Recipes that did not fit on this card. */
  overflow: Recipe[];
}

export const picconName = (n: number) => `PICCON${String(n).padStart(2, "0")}.NP3`;

const PICCON_RE = /^PICCON(\d{2})\.NP3$/i;
const NP3_RE = /\.NP3$/i;

export function usedPicconNumbers(existing: Iterable<string>): Set<number> {
  const used = new Set<number>();
  for (const name of existing) {
    const m = PICCON_RE.exec(name);
    if (m) used.add(Number(m[1]));
  }
  return used;
}

/** File-system-safe base name derived from the recipe's camera name. */
export function fileBaseFor(recipe: Recipe): string {
  return sanitizeNpName(recipe.npName).replace(/ /g, "_");
}

/**
 * Decide the file name of every recipe on one card, avoiding names that are
 * already present (compared case-insensitively, as FAT/exFAT do).
 */
export function planCardFiles(
  recipes: readonly Recipe[],
  opts: { mode: FileNameMode; existing?: Iterable<string>; startAt?: number },
): PackPlan {
  const existing = [...(opts.existing ?? [])];
  const taken = new Set(existing.map((n) => n.toUpperCase()));
  const existingNp3 = existing.filter((n) => NP3_RE.test(n)).length;
  const files: PlannedFile[] = [];
  const overflow: Recipe[] = [];

  if (opts.mode === "piccon") {
    const used = usedPicconNumbers(existing);
    const start = Math.min(MAX_PER_CARD, Math.max(1, Math.round(opts.startAt ?? 1)));
    const order = [
      ...Array.from({ length: MAX_PER_CARD - start + 1 }, (_, i) => start + i),
      ...Array.from({ length: start - 1 }, (_, i) => i + 1),
    ];
    const free = order.filter((n) => !used.has(n) && !taken.has(picconName(n)));
    // Non-PICCON .NP3 files on the card also count towards the 99-file limit.
    const capacity = Math.max(0, Math.min(free.length, MAX_PER_CARD - existingNp3));
    recipes.forEach((recipe, i) => {
      if (i < capacity) files.push({ fileName: picconName(free[i]), recipe });
      else overflow.push(recipe);
    });
    return { files, overflow };
  }

  const capacity = Math.max(0, MAX_PER_CARD - existingNp3);
  for (const recipe of recipes) {
    if (files.length >= capacity) {
      overflow.push(recipe);
      continue;
    }
    const base = fileBaseFor(recipe);
    let candidate = `${base}.NP3`;
    for (let i = 2; taken.has(candidate.toUpperCase()); i++) candidate = `${base}_${i}.NP3`;
    taken.add(candidate.toUpperCase());
    files.push({ fileName: candidate, recipe });
  }
  return { files, overflow };
}

function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function textIn(text: LocalizedText | undefined, lang: "ko" | "en" | "ja"): string {
  if (!text) return "";
  if (typeof text === "string") return text;
  return text[lang] ?? text.ko ?? text.en ?? text.ja ?? "";
}

/** LIST.txt placed next to the files so people can tell PICCONnn apart in Finder. */
export function manifestText(cards: PlannedFile[][], generatedAt = new Date()): string {
  const lines = [
    // BOM so Windows Notepad also shows the Korean text correctly.
    "\uFEFFNP3 Lab - Picture Control package",
    `Generated: ${localStamp(generatedAt)}`,
    "",
    "[KO] 카드의 NIKON/CUSTOMPC 폴더에 .NP3 파일을 복사한 뒤,",
    "     MENU > 사진 촬영 메뉴 > Picture Control 관리 > 로드/저장 > 카메라에 복사 (Zf: 저장/편집)",
    "[EN] Copy the .NP3 files into NIKON/CUSTOMPC on the card, then on the camera:",
    "     MENU > Photo shooting menu > Manage Picture Control > Load/save > Copy to camera (Zf: Save/edit)",
    "",
  ];
  cards.forEach((files, ci) => {
    if (cards.length > 1) lines.push(`== CARD-${ci + 1} ==`);
    for (const f of files) {
      const title = textIn(f.recipe.title, "en");
      const ko = textIn(f.recipe.title, "ko");
      const label = ko && ko !== title ? `${title} / ${ko}` : title;
      lines.push(`${f.fileName.padEnd(24)} ${f.recipe.npName.padEnd(20)} ${label}`);
    }
    lines.push("");
  });
  return lines.join("\r\n");
}
