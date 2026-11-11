import { signal } from "@preact/signals";
import { account, accountsEnabled, firebase, guest } from "./account";
import { t } from "./i18n";
import { recipeToBytes, type Recipe } from "./np3/recipe";
import { isPro } from "./pro";
import { openImport, showToast } from "./state";
import { base64ToBytes, bytesToBase64 } from "./storage";

/*
 * Pro: share your own recipes by link. A share is shares/<id> = { owner, title, np3, t } with the
 * recipe's Picture Control file (base64); firestore.rules let anyone with the id read it and only
 * Pro users create one. Opening a link goes through the usual import review, so the file is
 * checked like any NP3 and the recipient decides whether to keep it.
 */

/** Recipes you made or brought in yourself. Downloaded community recipes belong to their creators. */
export const canShare = (r: Recipe) => accountsEnabled && (r.source === "mine" || r.source === "imported") && !r.id.startsWith("card:");

/** Why sharing needs something first: sign in, or Pro. Read by the recipe dialog. */
export const shareNeeds = signal<"signIn" | "pro" | null>(null);
export const shareBusy = signal(false);

const titleOf = (r: Recipe) => {
  const title = typeof r.title === "string" ? r.title : (r.title.ko ?? r.title.en ?? r.title.ja ?? r.npName);
  return (title || r.npName).replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").trim().slice(0, 100) || "Recipe";
};

/** Create a link for the recipe and copy it. */
export async function shareRecipe(r: Recipe) {
  if (!canShare(r)) return;
  if (!account.value) {
    shareNeeds.value = "signIn";
    return;
  }
  if (!isPro.value) {
    shareNeeds.value = "pro";
    return;
  }
  shareBusy.value = true;
  try {
    const { collection, db, doc, setDoc } = await firebase();
    const ref = doc(collection(db, "shares"));
    await setDoc(ref, { owner: account.value.uid, title: titleOf(r), np3: bytesToBase64(recipeToBytes(r)), t: Date.now() });
    const url = `${location.origin}${location.pathname}?share=${ref.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(t("shareCopied"), "ok", 6000);
    } catch {
      prompt(t("shareCopyManually"), url);
    }
  } catch (err) {
    console.warn("share failed", err);
    showToast(t("shareFailed"), "error", 8000);
  } finally {
    shareBusy.value = false;
  }
}

/** A share link (?share=<id>) opened: show the recipe in the import review. No account needed. */
export async function openSharedFromUrl() {
  if (!accountsEnabled) return;
  const params = new URLSearchParams(location.search);
  const id = params.get("share");
  if (!id) return;
  params.delete("share");
  history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return;
  // Someone sent you a recipe: go straight to it rather than the sign-up page.
  if (!account.value) guest.value = true;
  try {
    const { db, doc, getDoc } = await firebase();
    const d = (await getDoc(doc(db, `shares/${id}`))).data() as { title?: unknown; np3?: unknown } | undefined;
    if (!d || typeof d.np3 !== "string") {
      showToast(t("shareNotFound"), "error", 8000);
      return;
    }
    const title = typeof d.title === "string" && d.title.trim() ? d.title.trim().slice(0, 100) : "Shared recipe";
    openImport("file", [{ name: `${title}.NP3`, bytes: base64ToBytes(d.np3) }]);
  } catch (err) {
    console.warn("open share failed", err);
    showToast(t("shareNotFound"), "error", 8000);
  }
}
