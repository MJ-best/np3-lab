import { computed, signal } from "@preact/signals";
import { CAMERA_GUIDES, DEFAULT_CAMERA } from "./cameraGuide";
import { ncpBytes, ncpToParams, toNcp } from "./np3/ncp";
import { isFlexible, normalizeParams, sanitizeNpName, type Recipe, type RecipeParams } from "./np3/recipe";
import { readStore, writeStore } from "./storage";

/** The camera the recipes are for, picked in the camera guide or in settings. */
export const cameraModel = signal<string>(readStore<string>("cameraModel") ?? DEFAULT_CAMERA);
export function setCameraModel(id: string) {
  cameraModel.value = id;
  writeStore("cameraModel", id);
}
export const currentCamera = computed(() => CAMERA_GUIDES.find((g) => g.id === cameraModel.value) ?? CAMERA_GUIDES[0]);
/** A body without Flexible Color (Z5, Z6, Z7, Z50 …): Flexible recipes reach it as original Picture Controls. */
export const legacyCamera = computed(() => !!currentCamera.value.legacy);

/** Flexible Color settings as an original Picture Control would show them. */
export const asLegacy = (p: RecipeParams) => normalizeParams(ncpToParams(toNcp(p)));

/** A Flexible recipe written as an original Picture Control (.NCP). */
export const legacyBytes = (npName: string, p: RecipeParams) => ncpBytes(sanitizeNpName(npName), toNcp(p));

/** What the preview shows for a recipe on the chosen camera. */
export function viewParams(r: { params: RecipeParams | null; raw?: Uint8Array }): RecipeParams | null {
  return r.params && legacyCamera.value && isFlexible(r) ? asLegacy(r.params) : r.params;
}

/** The recipe as it goes onto the card for the chosen camera. */
export function forCard(r: Recipe): Recipe {
  return legacyCamera.value && isFlexible(r) && r.params ? { ...r, raw: legacyBytes(r.npName, r.params) } : r;
}
