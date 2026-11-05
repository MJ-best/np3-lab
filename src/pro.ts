import { computed, effect, signal } from "@preact/signals";
import { account, accountsEnabled, firebase } from "./account";
import { lang, setLang, t } from "./i18n";
import { showToast } from "./state";

/*
 * NP3 Lab Pro (hosted web version): sharing your own recipes by link. Lemon Squeezy sells the
 * subscription; Cloud Functions record it in entitlements/<uid> (functions/index.js), which only
 * the user can read and only the server can write.
 */

/** Sales page, in the visitor's language. */
export const proPageUrl = () => (lang.value === "ko" ? "pro/" : `pro/${lang.value}.html`);

export const entitlement = signal<{ proUntil: number | null; status: string } | null>(null);
export const isPro = computed(() => (entitlement.value?.proUntil ?? 0) > Date.now());
export const checkoutBusy = signal(false);

async function loadEntitlement(uid: string) {
  const { db, doc, getDoc } = await firebase();
  const d = (await getDoc(doc(db, `entitlements/${uid}`))).data() as { proUntil?: { toMillis(): number } | null; status?: string } | undefined;
  if (account.value?.uid !== uid) return;
  entitlement.value = d ? { proUntil: d.proUntil?.toMillis() ?? null, status: d.status ?? "" } : null;
}

const callable = async <T>(name: string, data: unknown) => {
  const { functions, httpsCallable } = await firebase();
  return (await httpsCallable<unknown, T>(functions, name)(data)).data;
};

/** Go to the Lemon Squeezy checkout. Signed-in users only; the purchase is tied to the account. */
export async function startCheckout() {
  if (!account.value) {
    // Sign in first; checkout continues afterwards (see watchPro).
    sessionStorage.setItem("np3lab.upgrade", "1");
    showToast(t("proSignInFirst"), "info", 6000);
    return false;
  }
  checkoutBusy.value = true;
  try {
    const { url } = await callable<{ url: string }>("createCheckout", { lang: lang.value });
    location.href = url;
    return true;
  } catch (err) {
    console.warn("checkout failed", err);
    showToast(t("proCheckoutFailed"), "error", 8000);
    return false;
  } finally {
    checkoutBusy.value = false;
  }
}

/** Lemon Squeezy's customer portal: change the card, see invoices, cancel. */
export async function manageSubscription() {
  try {
    const { url } = await callable<{ url: string }>("manageSubscription", {});
    window.open(url, "_blank", "noopener");
  } catch (err) {
    console.warn("portal failed", err);
    showToast(t("proPortalFailed"), "error", 8000);
  }
}

/**
 * Keep the Pro status in step with the account, and handle the two ways into checkout from
 * outside the app: the sales page's ?upgrade=1 and the return from Lemon Squeezy (?pro=thanks).
 */
export function watchPro() {
  if (!accountsEnabled) return;
  const params = new URLSearchParams(location.search);
  // The sales page passes the visitor's language along.
  const l = params.get("lang");
  if (l === "ko" || l === "en" || l === "ja") setLang(l);
  if (params.get("upgrade") === "1") sessionStorage.setItem("np3lab.upgrade", "1");
  const thanks = params.get("pro") === "thanks";
  if (params.has("upgrade") || params.has("pro") || params.has("lang")) {
    params.delete("upgrade");
    params.delete("pro");
    params.delete("lang");
    history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`);
  }

  effect(() => {
    const uid = account.value?.uid;
    if (!uid) {
      entitlement.value = null;
      return;
    }
    void (async () => {
      await loadEntitlement(uid);
      if (thanks) {
        // The webhook usually lands within seconds of the redirect.
        for (let i = 0; i < 10 && !isPro.value; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          await loadEntitlement(uid);
        }
        showToast(isPro.value ? t("proWelcome") : t("proPending"), isPro.value ? "ok" : "info", 8000);
      } else if (sessionStorage.getItem("np3lab.upgrade") && !isPro.value) {
        sessionStorage.removeItem("np3lab.upgrade");
        await startCheckout();
      }
    })();
  });
}
