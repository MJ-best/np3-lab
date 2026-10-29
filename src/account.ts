import { computed, effect, signal } from "@preact/signals";
import { recipeFromBackup } from "./backup";
import { cameraModel, setCameraModel } from "./camera";
import { lang, t, type MessageKey } from "./i18n";
import type { Recipe } from "./np3/recipe";
import { cart, myRecipes, setMine, showToast, storedMine } from "./state";
import { readStore, writeStore } from "./storage";
import { changes, plan, type Entry } from "./syncPlan";

/*
 * Optional account on the hosted web version: sign in with Google and My recipes, the card list
 * and the camera model follow you between browsers. Photos and community recipe files stay on
 * the device (the community ones are downloaded from their source on each device).
 * Firestore: users/<uid>/recipes/<id> and users/<uid>/prefs/{cart,camera}, each { t, data | deleted }.
 */

/** Accounts exist only in the hosted web build (`npm run build:web`). */
export const accountsEnabled = import.meta.env.VITE_WEB === "1";

type Firebase = typeof import("./firebase");
// A constant false here lets the other builds leave Firebase out entirely.
const loadFirebase = accountsEnabled ? () => import("./firebase") : null;
let fbPromise: Promise<Firebase> | null = null;
const firebase = () => (fbPromise ??= loadFirebase!());

export const account = signal<{ uid: string; email: string | null } | null>(null);
export const syncStatus = signal<"syncing" | "ok" | "error" | null>(null);
export const lastSynced = signal<number | null>(null);

/** Set by "use without an account" on the sign-up page; the next visit starts there again. */
export const guest = signal(false);
const authChecked = signal(false);
// Remembered so a signed-in visitor goes straight to the app while Firebase is still loading.
const wasSignedIn = readStore<boolean>("signedIn") ?? false;
/** Visitors who aren't signed in start on the sign-up page (with how-to and updates). */
export const showLanding = computed(() => accountsEnabled && !account.value && !guest.value && (authChecked.value || !wasSignedIn));

const COLLECTIONS = ["recipes", "prefs"];

// ---------------------------------------------------------------------------
// What changed on this device, and when (kept while signed out too, so deletions still reach the account)

type Times = Record<string, { t: number; d?: 1 }>;
const times: Times = readStore<Times>("syncTimes") ?? {};
let known: Map<string, string> | null = null;
let applying = false;

function snapshot() {
  const m = new Map<string, string>();
  for (const r of storedMine()) m.set(`recipes/${r.id}`, JSON.stringify(r));
  m.set("prefs/cart", JSON.stringify(cart.value));
  m.set("prefs/camera", JSON.stringify(cameraModel.value));
  return m;
}

function localEntries() {
  const m = new Map<string, Entry>();
  for (const [path, x] of Object.entries(times)) if (x.d) m.set(path, { t: x.t, deleted: true });
  for (const [path, data] of known ?? snapshot()) m.set(path, { t: times[path]?.t ?? 0, data });
  return m;
}

function track() {
  effect(() => {
    const next = snapshot();
    if (known && !applying) {
      const { changed, removed } = changes(known, next);
      const now = Date.now();
      for (const path of changed) times[path] = { t: now };
      for (const path of removed) times[path] = { t: now, d: 1 };
      if (changed.length || removed.length) {
        writeStore("syncTimes", times);
        sendSoon([...changed, ...removed]);
      }
    }
    known = next;
  });
}

/** Apply what the account has newer. */
function take(pull: [string, Entry][]) {
  applying = true;
  try {
    const mine = new Map(myRecipes.value.map((r) => [r.id, r]));
    const added: Recipe[] = [];
    let recipesChanged = false;
    for (const [path, e] of pull) {
      const [col, id] = path.split("/");
      let value: unknown;
      try {
        value = e.data === undefined ? undefined : JSON.parse(e.data);
      } catch {
        continue;
      }
      if (col === "recipes") {
        // Data from outside this device: checked like a backup file.
        const r = value === undefined ? null : recipeFromBackup(value);
        if (!e.deleted && !r) continue;
        recipesChanged = true;
        if (!r) mine.delete(id);
        else if (mine.has(id)) mine.set(id, { ...r, id });
        else added.push({ ...r, id });
      } else if (id === "cart" && Array.isArray(value)) {
        cart.value = value.filter((x): x is string => typeof x === "string");
        writeStore("cart", cart.value);
      } else if (id === "camera" && typeof value === "string") {
        setCameraModel(value);
      }
      times[path] = e.deleted ? { t: e.t, d: 1 } : { t: e.t };
    }
    if (recipesChanged) setMine([...added, ...mine.values()]);
    writeStore("syncTimes", times);
  } finally {
    applying = false;
    known = snapshot();
  }
}

// ---------------------------------------------------------------------------
// Talking to the account

async function write(uid: string, entries: [string, Entry][]) {
  const { db, doc, writeBatch } = await firebase();
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    for (const [path, e] of entries.slice(i, i + 400))
      batch.set(doc(db, `users/${uid}/${path}`), e.deleted ? { t: e.t, deleted: true } : { t: e.t, data: e.data });
    await batch.commit();
  }
}

// ponytail: reads every synced item on each full sync (at sign-in, start and when the tab comes back);
// switch to a query on a server timestamp if Firestore read quotas start to matter.
async function syncAll() {
  const uid = account.value?.uid;
  if (!uid) return;
  const { collection, db, getDocs } = await firebase();
  const remote = new Map<string, Entry>();
  for (const col of COLLECTIONS) (await getDocs(collection(db, `users/${uid}/${col}`))).forEach((d) => remote.set(`${col}/${d.id}`, d.data() as Entry));
  if (account.value?.uid !== uid) return;
  const { pull, push } = plan(localEntries(), remote);
  if (pull.length) take(pull);
  if (push.length) await write(uid, push);
}

const outbox = new Set<string>();
let sendTimer: ReturnType<typeof setTimeout> | undefined;
/** Send local changes shortly after they happen; while signed out they wait for the next sign-in. */
function sendSoon(paths: string[]) {
  if (!account.value) return;
  for (const p of paths) outbox.add(p);
  clearTimeout(sendTimer);
  sendTimer = setTimeout(() => void run(sendOutbox), 1500);
}
async function sendOutbox() {
  const uid = account.value?.uid;
  const local = localEntries();
  const entries = [...outbox].flatMap((p) => (local.has(p) ? [[p, local.get(p)!] as [string, Entry]] : []));
  outbox.clear();
  if (uid && entries.length) await write(uid, entries);
}

let queue = Promise.resolve();
/** One sync job at a time. */
function run(job: () => Promise<void>) {
  queue = queue.then(async () => {
    if (!account.value) return;
    syncStatus.value = "syncing";
    try {
      await job();
      syncStatus.value = "ok";
      lastSynced.value = Date.now();
    } catch (err) {
      console.warn("sync failed", err);
      syncStatus.value = "error";
    }
  });
  return queue;
}
export const syncNow = () => run(syncAll);

// ---------------------------------------------------------------------------
// Signing in and out

let started = false;
export function startAccount() {
  if (!accountsEnabled || started) return;
  started = true;
  track();
  void firebase().then(({ auth, onAuthStateChanged }) =>
    onAuthStateChanged(auth, (user) => {
      account.value = user ? { uid: user.uid, email: user.email } : null;
      authChecked.value = true;
      writeStore("signedIn", !!user);
      syncStatus.value = null;
      if (user) void syncNow();
    }),
  );
  let lastFocus = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || Date.now() - lastFocus < 5 * 60_000) return;
    lastFocus = Date.now();
    void syncNow();
  });
}

const quiet = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]);
const AUTH_ERRORS: Record<string, MessageKey> = {
  "auth/popup-blocked": "signInPopupBlocked",
  "auth/email-already-in-use": "authEmailInUse",
  "auth/invalid-email": "authInvalidEmail",
  "auth/missing-email": "authInvalidEmail",
  "auth/weak-password": "authWeakPassword",
  "auth/missing-password": "authWeakPassword",
  "auth/invalid-credential": "authWrongPassword",
  "auth/wrong-password": "authWrongPassword",
  "auth/user-not-found": "authWrongPassword",
  "auth/too-many-requests": "authTooMany",
  "auth/network-request-failed": "authOffline",
};
/** A sign-in error in words, for the sign-up form and toasts. */
export function authErrorText(err: unknown) {
  const code = (err as { code?: string })?.code ?? "";
  return AUTH_ERRORS[code] ? t(AUTH_ERRORS[code]) : t("signInFailed", { msg: code || String(err) });
}
function reportAuthError(err: unknown) {
  if (quiet.has((err as { code?: string })?.code ?? "")) return;
  showToast(authErrorText(err), "error", 8000);
}

export async function signIn() {
  const { auth, google, signInWithPopup } = await firebase();
  try {
    await signInWithPopup(auth, google);
  } catch (err) {
    reportAuthError(err);
  }
}

// The email forms show their own errors, so these throw.
export async function signUpEmail(email: string, password: string) {
  const { auth, createUserWithEmailAndPassword } = await firebase();
  await createUserWithEmailAndPassword(auth, email, password);
}

export async function signInEmail(email: string, password: string) {
  const { auth, signInWithEmailAndPassword } = await firebase();
  await signInWithEmailAndPassword(auth, email, password);
}

export async function resetPassword(email: string) {
  const { auth, sendPasswordResetEmail } = await firebase();
  auth.languageCode = lang.value;
  await sendPasswordResetEmail(auth, email);
}

/** Sign out; this device keeps its recipes. */
export async function signOutAccount() {
  const { auth, signOut } = await firebase();
  clearTimeout(sendTimer);
  outbox.clear();
  await signOut(auth);
}

/** Delete everything in the account, then the account itself. This device keeps its recipes. */
export async function deleteAccount() {
  const fb = await firebase();
  const user = fb.auth.currentUser;
  if (!user) return;
  clearTimeout(sendTimer);
  outbox.clear();
  // Firebase deletes only an account signed in within the last few minutes. Google users confirm
  // in a popup below; email users sign in again first, before anything is deleted.
  const viaGoogle = user.providerData.some((p) => p.providerId === "google.com");
  if (!viaGoogle && Date.now() - Date.parse(user.metadata.lastSignInTime ?? "") > 4 * 60_000) {
    showToast(t("deleteAccountRelogin"), "error", 8000);
    await fb.signOut(fb.auth);
    return;
  }
  try {
    for (const col of COLLECTIONS) {
      const docs = (await fb.getDocs(fb.collection(fb.db, `users/${user.uid}/${col}`))).docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = fb.writeBatch(fb.db);
        for (const d of docs.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
      }
    }
    try {
      await fb.deleteUser(user);
    } catch (err) {
      if ((err as { code?: string })?.code !== "auth/requires-recent-login") throw err;
      await fb.reauthenticateWithPopup(user, fb.google);
      await fb.deleteUser(user);
    }
    showToast(t("accountDeleted"), "ok");
  } catch (err) {
    reportAuthError(err);
  } finally {
    // Signed out either way, so nothing is sent back to an account being deleted.
    if (fb.auth.currentUser) await fb.signOut(fb.auth);
  }
}
