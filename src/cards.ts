import { computed, signal } from "@preact/signals";
import { t } from "./i18n";
import { androidNative, isAndroid, isIos, native, nativeErrorMessage, type NativeCard } from "./native";
import { newId, parseNp3, recipeToBytes, sameBytes, withNpName, type Recipe } from "./np3/recipe";
import { planCardFiles } from "./pack/naming";
import { readStore, writeStore } from "./storage";
import { allRecipes, builtinsReady, isRetired, myRecipes, naming, showToast, upsertMine } from "./state";

/*
 * Desktop-only: memory cards reported by the Electron main process, what's in
 * their NIKON/CUSTOMPC folder, and the operations the card screen offers.
 */

export interface CardItem {
  fileName: string;
  bytes: Uint8Array;
  /** The matching library recipe, or a temporary one when it isn't in the library. */
  recipe: Recipe;
  inLibrary: boolean;
  /** A real picture-control file (NCP header), even if this app can't preview its settings. */
  valid: boolean;
}

export const cards = signal<NativeCard[]>([]);
export const activeCardId = signal<string | null>(null);
export const cardItems = signal<Record<string, CardItem[]>>({});
export const cardLoading = signal(false);
export const autoBackup = signal<boolean>(readStore<boolean>("autoBackup") ?? true);

export function setAutoBackup(on: boolean) {
  autoBackup.value = on;
  writeStore("autoBackup", on);
  if (on) void refreshActiveCard();
}

export const activeCard = computed(() => cards.value.find((c) => c.id === activeCardId.value) ?? cards.value[0] ?? null);
export const activeItems = computed(() => (activeCard.value ? cardItems.value[activeCard.value.id] ?? [] : []));

/** Temporary recipes for card files that aren't in the library, so the detail view can open them. */
export const cardRecipeById = computed(() => {
  const map = new Map<string, Recipe>();
  for (const items of Object.values(cardItems.value)) for (const it of items) map.set(it.recipe.id, it.recipe);
  return map;
});

/** Library recipe id → the file holding it on the active card. */
export const onActiveCard = computed(() => {
  const map = new Map<string, CardItem>();
  for (const it of activeItems.value) if (it.inLibrary) map.set(it.recipe.id, it);
  return map;
});

function libraryBytes(): { recipe: Recipe; bytes: Uint8Array }[] {
  const out: { recipe: Recipe; bytes: Uint8Array }[] = [];
  for (const r of allRecipes.value) {
    try {
      out.push({ recipe: r, bytes: recipeToBytes(r) });
    } catch {
      /* recipe without params or bytes */
    }
  }
  return out;
}

function toItems(card: NativeCard, files: { fileName: string; bytes: Uint8Array }[]): CardItem[] {
  const lib = libraryBytes();
  return files.map((f) => {
    const match = lib.find((l) => sameBytes(l.bytes, f.bytes));
    if (match) return { fileName: f.fileName, bytes: f.bytes, recipe: match.recipe, inLibrary: true, valid: true };
    let npName = f.fileName.replace(/\.np3$/i, "");
    let params = null;
    let valid = false;
    try {
      const parsed = parseNp3(f.bytes);
      npName = parsed.npName;
      params = parsed.params;
      valid = true;
    } catch {
      /* not a picture control: still listed so it can be removed */
    }
    const recipe: Recipe = {
      id: `card:${card.id}:${f.fileName}`,
      source: "imported",
      title: npName,
      npName,
      tags: [],
      params,
      raw: f.bytes,
      origin: { kind: "card", author: card.name },
    };
    return { fileName: f.fileName, bytes: f.bytes, recipe, inLibrary: false, valid };
  });
}

/**
 * Copy card files that aren't in the library yet into My recipes. Files this app
 * can't preview are kept too (as raw bytes), so formatting the card never loses them.
 * Versions the user deleted or changed in My recipes stay out.
 */
function backupNew(card: NativeCard, items: CardItem[]): number {
  const fresh = items.filter((it) => !it.inLibrary && it.valid && !isRetired(it.bytes));
  const now = Date.now();
  fresh.forEach((it, i) => {
    const recipe: Recipe = { ...it.recipe, id: newId("card"), createdAt: now + i, origin: { kind: "card", author: card.name } };
    upsertMine(recipe);
    it.recipe = recipe;
    it.inLibrary = true;
  });
  return fresh.length;
}

export async function refreshCard(card: NativeCard, quiet = false) {
  if (!native) return;
  cardLoading.value = true;
  try {
    await builtinsReady;
    const files = await native.readCard(card.path);
    const items = toItems(card, files);
    const added = autoBackup.value ? backupNew(card, items) : 0;
    cardItems.value = { ...cardItems.value, [card.id]: items };
    if (added > 0 && !quiet) showToast(t("autoBackedUp", { n: added }), "ok", 5000);
  } catch (err) {
    showToast(t("cardError", { msg: nativeErrorMessage(err) }), "error", 7000);
  } finally {
    cardLoading.value = false;
  }
}

export async function refreshActiveCard() {
  if (activeCard.value) await refreshCard(activeCard.value);
}

function applyCards(next: NativeCard[]) {
  const prevIds = new Set(cards.value.map((c) => c.id));
  cards.value = next;
  const ids = new Set(next.map((c) => c.id));
  cardItems.value = Object.fromEntries(Object.entries(cardItems.value).filter(([id]) => ids.has(id)));
  // Switch to a newly inserted card; keep the current one otherwise.
  const inserted = next.find((c) => !prevIds.has(c.id));
  if (inserted) activeCardId.value = inserted.id;
  else if (!next.some((c) => c.id === activeCardId.value)) activeCardId.value = next[0]?.id ?? null;
  for (const c of next) {
    const known = cardItems.value[c.id];
    if (!known || known.length !== c.np3Count) void refreshCard(c);
  }
}

let started = false;
export function startCardSync() {
  if (!native || started) return;
  started = true;
  native.onCardsChanged(applyCards);
  void native.listCards().then(applyCards);
  // Files may have been changed in Finder while the app was in the background.
  window.addEventListener("focus", () => void refreshActiveCard());
  if (isAndroid) document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && void refreshActiveCard());
}

function fail(err: unknown) {
  showToast(t("cardError", { msg: nativeErrorMessage(err) }), "error", 8000);
}

/** File names currently on the card, read fresh so name choices never rely on a stale listing. */
async function namesOnCard(card: NativeCard): Promise<string[]> {
  return (await native!.readCard(card.path)).map((f) => f.fileName);
}

/** Write recipes to the active card (PICCONnn names, never overwriting). */
export async function addToActiveCard(recipes: Recipe[]): Promise<void> {
  const card = activeCard.value;
  if (!native || !card || recipes.length === 0) return;
  try {
    const plan = planCardFiles(recipes, { mode: naming.value, existing: await namesOnCard(card) });
    const written = plan.files.map((f) => f.fileName);
    if (written.length > 0) {
      await native.writeFiles(
        card.path,
        plan.files.map((f) => ({ fileName: f.fileName, bytes: recipeToBytes(f.recipe) })),
      );
      showToast(t("addedToCard", { n: written.length }), "ok", 6000, {
        label: t("undo"),
        run: () => void undoAdd(card, written),
      });
    }
    if (plan.overflow.length > 0) showToast(t("cardFull", { n: plan.overflow.length }), "warn", 7000);
  } catch (err) {
    fail(err);
  } finally {
    await refreshCard(card, true);
  }
}

async function undoAdd(card: NativeCard, fileNames: string[]) {
  if (!native) return;
  // Keep going if one file is already gone (e.g. removed by hand in the meantime).
  for (const name of fileNames) await native.trashFile(card.path, name).catch(() => undefined);
  await refreshCard(card, true);
}

/** Put a removed file back, under a new name if its old one has been taken since. */
async function restoreToCard(card: NativeCard, item: CardItem) {
  if (!native) return;
  try {
    const existing = await namesOnCard(card);
    const taken = existing.some((n) => n.toUpperCase() === item.fileName.toUpperCase());
    const fileName = taken
      ? planCardFiles([{ ...item.recipe, raw: item.bytes }], { mode: naming.value, existing }).files[0]?.fileName
      : item.fileName;
    if (!fileName) {
      showToast(t("cardFull", { n: 1 }), "warn", 7000);
      return;
    }
    await native.writeFiles(card.path, [{ fileName, bytes: item.bytes }]);
  } catch (err) {
    fail(err);
  } finally {
    await refreshCard(card, true);
  }
}

/** Move a file on the card to the Trash (restorable with Undo). */
export async function removeFromActiveCard(item: CardItem) {
  const card = activeCard.value;
  if (!native || !card) return;
  try {
    await native.trashFile(card.path, item.fileName);
    await refreshCard(card, true);
    showToast(t("removedFromCard", { name: item.recipe.npName }), "ok", 6000, {
      label: t("undo"),
      run: () => void restoreToCard(card, item),
    });
  } catch (err) {
    fail(err);
  }
}

/** Change the name shown on the camera. The library copy is renamed too so they stay matched. */
export async function renameOnActiveCard(item: CardItem, name: string) {
  const card = activeCard.value;
  if (!native || !card) return;
  const bytes = withNpName(item.bytes, name);
  const newName = parseNp3(bytes).npName;
  if (newName === item.recipe.npName) return;
  try {
    await native.writeFiles(card.path, [{ fileName: item.fileName, bytes, overwrite: true }]);
    const lib = myRecipes.value.find((r) => r.id === item.recipe.id);
    if (lib) {
      const retitle = lib.title === lib.npName;
      upsertMine({ ...lib, raw: lib.raw ? withNpName(lib.raw, newName) : undefined, npName: newName, title: retitle ? newName : lib.title });
    }
    await refreshCard(card, true);
    showToast(t("renamed", { name: newName }), "ok");
  } catch (err) {
    fail(err);
  }
}

/** Android: let the user choose the SD card folder (once per card). */
export async function pickAndroidCard() {
  if (!androidNative) return;
  try {
    const r = await androidNative.pickCard();
    if ("notACard" in r) showToast(t("notANikonCard", { name: r.notACard }), "warn", 8000);
    else if ("card" in r) applyCards(await native!.listCards());
  } catch (err) {
    fail(err);
  }
}

export async function ejectActiveCard() {
  const card = activeCard.value;
  if (!native || !card) return;
  if (isAndroid) {
    showToast(t(isIos ? "ejectIos" : "ejectAndroid"), "info", 8000);
    return;
  }
  try {
    await native.eject(card.path);
    showToast(t("ejected", { name: card.name }), "ok", 6000);
  } catch (err) {
    fail(err);
  }
}

export async function revealActiveCard() {
  const card = activeCard.value;
  if (native && card) await native.reveal(card.path).catch(fail);
}

export function formatBytes(n: number | null): string {
  if (n === null) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

