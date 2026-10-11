import { computed, signal } from "@preact/signals";
import { BUILTIN_RECIPES, loadBundledNp3 } from "./builtinRecipes";
import { recipeFromBackup } from "./backup";
import { downloadCommunityRecipes, forgetCommunityRecipes, isCommunityRecipe, storedCommunityRecipes } from "./community";
import { t, tx } from "./i18n";
import { isDesktop } from "./native";
import {
  TONE_KEYS,
  defaultParams,
  isValidNpName,
  newId,
  normalizeParams,
  parseNp3,
  recipeToBytes,
  sameBytes,
  sanitizeNpName,
  type Recipe,
  type RecipeOrigin,
  type RecipeParams,
} from "./np3/recipe";
import { IDENTITY_POINTS, toneCurveFromPoints, type CurvePoint } from "./np3/toneCurve";
import type { FileNameMode } from "./pack/naming";
import { SCENES, addPhotos, deletePhoto, fullPhoto, photosByRecipe, sourceKeyOf } from "./photos";
import { BUILTIN_SAMPLES, forgetSample, type Sample } from "./render/samples";
import { base64ToBytes, bytesToBase64, readStore, writeStore } from "./storage";

// ---------------------------------------------------------------------------
// Navigation & UI

export type Route = "gallery" | "photos" | "editor" | "card";
export const route = signal<Route>(isDesktop ? "card" : "gallery");
export const detailId = signal<string | null>(null);
/** Which side of the recipe dialog to open on; null lets it decide (photos first when there are any). */
export const detailTab = signal<"photos" | "preview" | null>(null);

export type GalleryFilter = "all" | "mine" | "reddit" | "imaging-cloud" | `tag:${string}`;
/** Search text, shared by the Recipes and Gallery tabs so it carries over between them. */
export const recipeQuery = signal("");
/** Recipes-tab filter. */
export const galleryFilter = signal<GalleryFilter>("all");

/** Open a recipe on its "Shot with this recipe" gallery. */
export function openRecipePhotos(id: string) {
  detailTab.value = "photos";
  detailId.value = id;
}
export const pasteOpen = signal(false);

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "ok" | "warn" | "error";
  /** Optional button, e.g. "Undo". */
  action?: { label: string; run: () => void };
}
export const toasts = signal<Toast[]>([]);
let toastSeq = 0;
export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((x) => x.id !== id);
}
export function showToast(text: string, kind: Toast["kind"] = "info", ms = 4000, action?: Toast["action"]) {
  const id = ++toastSeq;
  toasts.value = [...toasts.value, { id, text, kind, action }];
  setTimeout(() => dismissToast(id), action ? Math.max(ms, 7000) : ms);
}

// ---------------------------------------------------------------------------
// Recipes

interface StoredRecipe extends Omit<Recipe, "raw"> {
  raw?: string;
}

function loadMine(): Recipe[] {
  const stored = readStore<StoredRecipe[]>("recipes") ?? [];
  return stored.map((r) => ({ ...r, raw: r.raw ? base64ToBytes(r.raw) : undefined }));
}

function toStored(r: Recipe): StoredRecipe {
  return { ...r, raw: r.raw ? bytesToBase64(r.raw) : undefined };
}

export const myRecipes = signal<Recipe[]>(loadMine());
const persistMine = () => writeStore("recipes", myRecipes.value.map(toStored));

export const builtinRecipes = signal<Recipe[]>([...BUILTIN_RECIPES, ...storedCommunityRecipes]);

/** Download (or update) the community recipes and swap them into the library. */
export async function refreshCommunityRecipes(): Promise<void> {
  try {
    const recipes = await downloadCommunityRecipes();
    if (!recipes) {
      showToast(t("communityUpToDate"), "info");
      return;
    }
    builtinRecipes.value = [...builtinRecipes.value.filter((r) => !isCommunityRecipe(r)), ...recipes];
    showToast(t("communityDone", { n: recipes.length }), "ok", 5000);
  } catch (err) {
    showToast(t("communityFailed", { msg: String((err as Error)?.message ?? err) }), "error", 8000);
  }
}
export function removeCommunityRecipes() {
  forgetCommunityRecipes();
  builtinRecipes.value = builtinRecipes.value.filter((r) => !isCommunityRecipe(r));
}
/** Resolves once the bundled NP3 recipes are in `builtinRecipes`. */
export const builtinsReady: Promise<void> = loadBundledNp3().then((extra) => {
  if (extra.length > 0) builtinRecipes.value = [...builtinRecipes.value, ...extra];
});

export const allRecipes = computed(() => [...myRecipes.value, ...builtinRecipes.value]);
export const recipeById = computed(() => new Map(allRecipes.value.map((r) => [r.id, r])));

// ponytail: 32-bit hash + length; a collision only means one card file isn't backed up automatically.
const bytesKey = (b: Uint8Array) => {
  let h = 2166136261;
  for (const x of b) h = Math.imul(h ^ x, 16777619);
  return `${b.length}.${(h >>> 0).toString(36)}`;
};
const retired = new Set(readStore<string[]>("retired") ?? []);
/** Remember a version that is leaving My recipes (deleted, or changed), so auto-backup won't copy it back from a card. */
function retire(r: Recipe) {
  try {
    const key = bytesKey(recipeToBytes(r));
    if (retired.has(key)) return;
    retired.add(key);
    writeStore("retired", [...retired].slice(-500));
  } catch {
    /* no bytes: nothing a card could hold */
  }
}
/** Is this card file a recipe version the user deleted or changed? */
export const isRetired = (bytes: Uint8Array) => retired.has(bytesKey(bytes));

export function upsertMine(recipe: Recipe) {
  const list = myRecipes.value;
  const i = list.findIndex((r) => r.id === recipe.id);
  if (i >= 0) retire(list[i]);
  myRecipes.value = i >= 0 ? list.map((r, j) => (j === i ? recipe : r)) : [recipe, ...list];
  persistMine();
}

export function deleteMine(id: string) {
  const gone = myRecipes.value.find((r) => r.id === id);
  if (gone) retire(gone);
  for (const p of photosByRecipe.value[id] ?? []) void deletePhoto(p.id);
  myRecipes.value = myRecipes.value.filter((r) => r.id !== id);
  persistMine();
  removeFromCart(id);
  if (draft.value.editingId === id) draft.value = { ...draft.value, editingId: null, dirty: true };
}


export function updateMine(id: string, patch: Partial<Pick<Recipe, "title" | "origin" | "npName" | "raw">>) {
  const r = myRecipes.value.find((x) => x.id === id);
  if (r) upsertMine({ ...r, ...patch });
}

// ---------------------------------------------------------------------------
// NP3 import review (files, card folder, Imaging Cloud backups)

export type ImportMode = "file" | "imaging-cloud";

export interface ImportEntry {
  key: string;
  fileName: string;
  bytes: Uint8Array;
  npName: string;
  params: RecipeParams | null;
  status: "new" | "duplicate" | "no-preview" | "invalid";
  title: string;
  selected: boolean;
}

export interface ImportSession {
  mode: ImportMode;
  entries: ImportEntry[];
  /** Applied to every imported recipe (e.g. the Imaging Cloud creator). */
  author: string;
}

export const importSession = signal<ImportSession | null>(null);

function reviewFile(f: { name: string; bytes: Uint8Array }, earlier: ImportEntry[]): ImportEntry {
  const stem = f.name.replace(/\.np3$/i, "");
  const key = `${f.name}:${f.bytes.length}:${Math.random().toString(36).slice(2, 7)}`;
  let parsed;
  try {
    parsed = parseNp3(f.bytes);
  } catch {
    return { key, fileName: f.name, bytes: f.bytes, npName: "", params: null, status: "invalid", title: stem, selected: false };
  }
  const duplicate =
    myRecipes.value.some((r) => r.raw && sameBytes(r.raw, f.bytes)) || earlier.some((e) => sameBytes(e.bytes, f.bytes));
  return {
    key,
    fileName: f.name,
    bytes: f.bytes,
    npName: parsed.npName,
    params: parsed.params,
    status: duplicate ? "duplicate" : parsed.params ? "new" : "no-preview",
    // PICCONnn tells nothing; the name stored in the file is more useful.
    title: /^PICCON\d\d$/i.test(stem) ? parsed.npName : stem,
    selected: !duplicate,
  };
}

/** Open the import review dialog, optionally with files already chosen. */
export function openImport(mode: ImportMode, files: { name: string; bytes: Uint8Array }[] = []) {
  const current = importSession.value;
  const base = current && current.mode === mode ? current : { mode, entries: [], author: "" };
  const entries = [...base.entries];
  for (const f of files) entries.push(reviewFile(f, entries));
  importSession.value = { ...base, entries };
}

export function updateImportEntry(key: string, patch: Partial<Pick<ImportEntry, "title" | "selected">>) {
  const s = importSession.value;
  if (!s) return;
  importSession.value = { ...s, entries: s.entries.map((e) => (e.key === key ? { ...e, ...patch } : e)) };
}

/** Save the selected entries to My recipes and close the dialog. */
export function commitImport(): Recipe[] {
  const s = importSession.value;
  if (!s) return [];
  const origin: RecipeOrigin = { kind: s.mode === "imaging-cloud" ? "imaging-cloud" : "file" };
  if (s.author.trim()) origin.author = s.author.trim();
  const now = Date.now();
  const imported = s.entries
    .filter((e) => e.selected && e.status !== "invalid")
    .map<Recipe>((e, i) => ({
      id: newId("imp"),
      source: "imported",
      title: e.title.trim() || e.npName,
      npName: e.npName,
      tags: [],
      params: e.params,
      raw: e.bytes,
      origin,
      createdAt: now + i,
    }));
  if (imported.length > 0) {
    myRecipes.value = [...imported, ...myRecipes.value];
    persistMine();
    showToast(t("importedCount", { n: imported.length }), "ok");
  }
  importSession.value = null;
  return imported;
}

// ---------------------------------------------------------------------------
// Text recipes (Reddit posts, forum threads)

export interface TextRecipeDraft {
  title: string;
  npName: string;
  params: RecipeParams;
  author?: string;
}

/** Save recipes parsed from text as editable My recipes. */
export function saveTextRecipes(items: TextRecipeDraft[], source: { kind: RecipeOrigin["kind"]; url?: string; author?: string }, alsoAddToCart: boolean): Recipe[] {
  const now = Date.now();
  const saved = items.map<Recipe>((item, i) => {
    const origin: RecipeOrigin = { kind: source.kind };
    if (source.url) origin.url = source.url;
    const author = item.author ?? source.author;
    if (author) origin.author = author;
    return {
      id: newId("txt"),
      source: "mine",
      title: item.title.trim() || item.npName,
      npName: sanitizeNpName(item.npName),
      tags: [],
      params: item.params,
      origin,
      createdAt: now + i,
    };
  });
  myRecipes.value = [...saved, ...myRecipes.value];
  persistMine();
  if (alsoAddToCart) saved.forEach((r) => addToCart(r.id));
  showToast(t("savedCount", { n: saved.length }), "ok");
  return saved;
}

export function exportBackup(): string {
  return JSON.stringify({ app: "np3-lab", version: 1, recipes: myRecipes.value.map(toStored) }, null, 2);
}

export function importBackup(text: string): number {
  const data = JSON.parse(text) as { app?: string; recipes?: unknown[] };
  if (!["np3-lab", "nikon-pc-lab"].includes(data.app ?? "") || !Array.isArray(data.recipes)) throw new Error("invalid backup");
  const incoming = data.recipes.slice(0, 5000).map(recipeFromBackup).filter((r): r is Recipe => r !== null);
  const ids = new Set(incoming.map((r) => r.id));
  myRecipes.value = [...incoming, ...myRecipes.value.filter((r) => !ids.has(r.id))];
  persistMine();
  return incoming.length;
}

// ---------------------------------------------------------------------------
// SD card basket

export const cart = signal<string[]>(readStore<string[]>("cart") ?? []);
const persistCart = () => writeStore("cart", cart.value);
export const cartRecipes = computed(() =>
  cart.value.map((id) => recipeById.value.get(id)).filter((r): r is Recipe => !!r),
);

export function addToCart(id: string) {
  if (!cart.value.includes(id)) cart.value = [...cart.value, id];
  persistCart();
}
export function removeFromCart(id: string) {
  cart.value = cart.value.filter((x) => x !== id);
  persistCart();
}
export function toggleCart(id: string) {
  if (cart.value.includes(id)) removeFromCart(id);
  else addToCart(id);
}
export function moveInCart(id: string, delta: -1 | 1) {
  const list = [...cart.value];
  const i = list.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  cart.value = list;
  persistCart();
}
export function clearCart() {
  cart.value = [];
  persistCart();
}

export const naming = signal<FileNameMode>(readStore<FileNameMode>("naming") ?? "piccon");
export function setNaming(mode: FileNameMode) {
  naming.value = mode;
  writeStore("naming", mode);
}

// ---------------------------------------------------------------------------
// Preview scenes

// Your own photos, kept in the photo library: shown oldest first, after the built-in scenes.
const PHOTO_EXT = /\.(jpe?g|png|webp|gif|heic|heif|avif|tiff?|nef|nrw)$/i;
export const userSamples = computed(() =>
  (photosByRecipe.value[SCENES] ?? [])
    .slice()
    .reverse()
    .map((p): Sample => {
      const name = p.name.replace(PHOTO_EXT, "");
      return { id: p.id, label: { ko: name, en: name, ja: name }, kind: "user", thumb: p.thumbUrl, blob: () => fullPhoto(p.id) };
    }),
);
export const allSamples = computed(() => [...BUILTIN_SAMPLES, ...userSamples.value]);
export const activeSampleId = signal<string>(readStore<string>("sample") ?? BUILTIN_SAMPLES[0].id);
export const activeSample = computed(
  () => allSamples.value.find((s) => s.id === activeSampleId.value) ?? allSamples.value[0],
);
export function setActiveSample(id: string) {
  activeSampleId.value = id;
  writeStore("sample", id);
}
/** Keep a photo as a preview scene (adding the same file again just picks it). */
export async function addUserPhoto(file: File): Promise<boolean> {
  await addPhotos(SCENES, [file]);
  const scene = photosByRecipe.value[SCENES]?.find((p) => p.sourceKey === sourceKeyOf(file));
  if (!scene) {
    showToast(t("photoAddFailed", { name: file.name }), "error");
    return false;
  }
  setActiveSample(scene.id);
  showToast(t("photoAdded", { name: file.name }), "ok");
  return true;
}
/** Delete one of your preview scenes; the one next to it is shown instead. */
export async function deleteScene(id: string) {
  const list = userSamples.value;
  const i = list.findIndex((s) => s.id === id);
  if (activeSampleId.value === id) setActiveSample((list[i + 1] ?? list[i - 1] ?? BUILTIN_SAMPLES[0]).id);
  await deletePhoto(id);
  forgetSample(id);
}

// ---------------------------------------------------------------------------
// Editor draft

export type ToneMode = "sliders" | "curve";

export interface Draft {
  /** Id of a "mine" recipe edited in place, or null for a new recipe. */
  editingId: string | null;
  title: string;
  npName: string;
  /** Slider values are kept even in curve mode so switching back restores them. */
  params: RecipeParams;
  toneMode: ToneMode;
  curvePoints: CurvePoint[];
  dirty: boolean;
}

function blankDraft(): Draft {
  return {
    editingId: null,
    title: t("newTitle"),
    npName: "MY_RECIPE",
    params: defaultParams(),
    toneMode: "sliders",
    curvePoints: IDENTITY_POINTS.map((p) => ({ ...p })),
    dirty: false,
  };
}

function loadDraft(): Draft {
  const stored = readStore<Draft>("draft");
  return stored && stored.params ? { ...blankDraft(), ...stored } : blankDraft();
}

export const draft = signal<Draft>(loadDraft());
let draftTimer: ReturnType<typeof setTimeout> | undefined;
export function updateDraft(patch: Partial<Draft>) {
  draft.value = { ...draft.value, ...patch, dirty: true };
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => writeStore("draft", draft.value), 400);
}
export function updateDraftParams(patch: Partial<RecipeParams>) {
  updateDraft({ params: { ...draft.value.params, ...patch } });
}

/** Parameters exactly as they will be written to the NP3 file. */
export const draftParams = computed<RecipeParams>(() => {
  const d = draft.value;
  const { toneCurve: _unused, ...rest } = d.params;
  return d.toneMode === "curve" ? normalizeParams({ ...rest, toneCurve: toneCurveFromPoints(d.curvePoints) }) : normalizeParams(rest);
});

export function resetDraft() {
  draft.value = blankDraft();
  writeStore("draft", draft.value);
}

export function openInEditor(recipe: Recipe) {
  if (!recipe.params) return;
  const editable = recipe.source === "mine" && !recipe.raw;
  const curve = recipe.params.toneCurve;
  const params = { ...recipe.params };
  delete params.toneCurve;
  draft.value = {
    editingId: editable ? recipe.id : null,
    title: editable ? tx(recipe.title) : `${tx(recipe.title)} ${t("copySuffix")}`,
    npName: recipe.npName,
    params,
    toneMode: curve ? "curve" : "sliders",
    curvePoints: curve?.points.length ? curve.points.map((p) => ({ ...p })) : IDENTITY_POINTS.map((p) => ({ ...p })),
    dirty: !editable,
  };
  writeStore("draft", draft.value);
  detailId.value = null;
  route.value = "editor";
}

export function loadParamsIntoEditor(params: RecipeParams, name?: string, npName?: string) {
  const curve = params.toneCurve;
  const rest = { ...params };
  delete rest.toneCurve;
  draft.value = {
    ...blankDraft(),
    title: name ?? t("newTitle"),
    npName: npName ?? (name ? sanitizeNpName(name) : "MY_RECIPE"),
    params: rest,
    toneMode: curve ? "curve" : "sliders",
    curvePoints: curve?.points.length ? curve.points.map((p) => ({ ...p })) : IDENTITY_POINTS.map((p) => ({ ...p })),
    dirty: true,
  };
  writeStore("draft", draft.value);
  route.value = "editor";
}

/** Save the draft to My recipes. Returns the saved recipe, or null when the name is invalid. */
export function saveDraft(asNew = false): Recipe | null {
  const d = draft.value;
  if (!isValidNpName(d.npName)) {
    showToast(t("nameInvalid"), "error");
    return null;
  }
  const existing = !asNew && d.editingId ? myRecipes.value.find((r) => r.id === d.editingId) : undefined;
  const recipe: Recipe = {
    id: existing?.id ?? newId("mine"),
    source: "mine",
    title: d.title.trim() || d.npName,
    npName: d.npName,
    tags: existing?.tags ?? [],
    params: draftParams.value,
    origin: existing?.origin,
    createdAt: existing?.createdAt ?? Date.now(),
  };
  upsertMine(recipe);
  draft.value = { ...d, editingId: recipe.id, dirty: false };
  writeStore("draft", draft.value);
  showToast(t("saved", { name: tx(recipe.title) }), "ok");
  return recipe;
}

export { TONE_KEYS };
