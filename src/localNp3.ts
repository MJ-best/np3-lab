import { t } from "./i18n";
import { native, type LocalNp3File } from "./native";
import { recipeToBytes, sameBytes } from "./np3/recipe";
import { allRecipes, openImport, showToast } from "./state";
import { readStore, writeStore } from "./storage";

/*
 * NP3 files saved anywhere on this Mac — typically Picture Controls exported from
 * NX Studio — found with Spotlight, so nobody has to remember the export folder.
 */

const SEEN_KEY = "localNp3Seen";
const CHECK_INTERVAL_MS = 15_000;

function inLibrary(bytes: Uint8Array): boolean {
  return allRecipes.value.some((r) => {
    try {
      return sameBytes(recipeToBytes(r), bytes);
    } catch {
      return false;
    }
  });
}

/** Remember the newest file we've offered so the same files aren't announced again. */
function markSeen(files: LocalNp3File[]) {
  const newest = Math.max(readStore<number>(SEEN_KEY) ?? 0, ...files.map((f) => f.mtimeMs));
  writeStore(SEEN_KEY, newest);
}

const toImport = (files: LocalNp3File[]) => files.map(({ name, bytes }) => ({ name, bytes }));

/** "Find NP3 files on this Mac": every NP3, newest first, in the import review. */
export async function importFromThisMac(): Promise<void> {
  if (!native) return;
  try {
    const files = await native.findLocalNp3();
    markSeen(files);
    if (files.length === 0) {
      showToast(t("localNp3None"), "info", 6000);
      return;
    }
    openImport("file", toImport(files));
  } catch (err) {
    showToast(t("localNp3Failed", { msg: String((err as Error)?.message ?? err) }), "error");
  }
}

let checking = false;
let lastCheck = 0;

/**
 * Look for NP3 files saved since the last check and offer to import the ones that
 * aren't in the library yet. Runs at start-up and whenever the window comes forward.
 */
export async function checkForNewLocalNp3(): Promise<void> {
  if (!native || checking || Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
  checking = true;
  lastCheck = Date.now();
  try {
    const files = await native.findLocalNp3(readStore<number>(SEEN_KEY) ?? 0);
    if (files.length === 0) return;
    markSeen(files);
    const fresh = files.filter((f) => !inLibrary(f.bytes));
    if (fresh.length === 0) return;
    showToast(t("localNp3Found", { n: fresh.length, name: fresh[0].name }), "info", 12_000, {
      label: t("localNp3Import"),
      run: () => openImport("file", toImport(fresh)),
    });
  } catch {
    /* Spotlight unavailable; the manual search reports errors */
  } finally {
    checking = false;
  }
}
