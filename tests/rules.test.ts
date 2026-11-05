// Firestore security rules against the emulator: `npm run test:rules` (needs Java 21).
// Skipped in the normal `npm test`, which runs without an emulator.
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const emulator = process.env.FIRESTORE_EMULATOR_HOST;
const DAY = 24 * 60 * 60 * 1000;
const share = (owner: string, extra: Record<string, unknown> = {}) => ({ owner, title: "Golden Hour", np3: "TkNQAA==", t: 1, ...extra });

describe.skipIf(!emulator)("firestore.rules", () => {
  let env: RulesTestEnvironment;
  const as = (uid: string | null) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

  beforeAll(async () => {
    const [host, port] = emulator!.split(":");
    env = await initializeTestEnvironment({
      projectId: "demo-np3lab",
      firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
    });
  });
  afterAll(() => env?.cleanup());

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "entitlements/pro"), { plan: "pro", status: "active", proUntil: Timestamp.fromMillis(Date.now() + 30 * DAY) });
      await setDoc(doc(db, "entitlements/lapsed"), { plan: "pro", status: "expired", proUntil: Timestamp.fromMillis(Date.now() - DAY) });
      await setDoc(doc(db, "entitlements/cancelled"), { plan: "pro", status: "expired", proUntil: null });
      await setDoc(doc(db, "shares/existing01"), share("pro"));
    });
  });

  describe("entitlements", () => {
    it("are readable by their owner only", async () => {
      await assertSucceeds(getDoc(doc(as("pro"), "entitlements/pro")));
      await assertFails(getDoc(doc(as("other"), "entitlements/pro")));
      await assertFails(getDoc(doc(as(null), "entitlements/pro")));
    });

    it("can't be written by anyone but the server", async () => {
      const forever = { plan: "pro", status: "active", proUntil: Timestamp.fromMillis(Date.now() + 9999 * DAY) };
      await assertFails(setDoc(doc(as("free"), "entitlements/free"), forever));
      await assertFails(updateDoc(doc(as("lapsed"), "entitlements/lapsed"), { proUntil: forever.proUntil }));
      await assertFails(deleteDoc(doc(as("pro"), "entitlements/pro")));
    });
  });

  describe("creating share links", () => {
    it("is allowed for an active Pro user", async () => {
      await assertSucceeds(setDoc(doc(as("pro"), "shares/new0000001"), share("pro")));
    });

    it("is refused without Pro: free, lapsed, cancelled, signed out", async () => {
      await assertFails(setDoc(doc(as("free"), "shares/new0000002"), share("free")));
      await assertFails(setDoc(doc(as("lapsed"), "shares/new0000003"), share("lapsed")));
      await assertFails(setDoc(doc(as("cancelled"), "shares/new0000004"), share("cancelled")));
      await assertFails(setDoc(doc(as(null), "shares/new0000005"), share("pro")));
    });

    it("is refused for someone else's name, extra fields or oversized content", async () => {
      await assertFails(setDoc(doc(as("pro"), "shares/new0000006"), share("other")));
      await assertFails(setDoc(doc(as("pro"), "shares/new0000007"), share("pro", { admin: true })));
      await assertFails(setDoc(doc(as("pro"), "shares/new0000008"), share("pro", { title: "x".repeat(101) })));
      await assertFails(setDoc(doc(as("pro"), "shares/new0000009"), share("pro", { title: "" })));
      await assertFails(setDoc(doc(as("pro"), "shares/new0000010"), share("pro", { np3: "A".repeat(90001) })));
      await assertFails(setDoc(doc(as("pro"), "shares/new0000011"), share("pro", { t: "now" })));
    });
  });

  describe("opening and managing share links", () => {
    it("opens by id for anyone, signed in or not", async () => {
      await assertSucceeds(getDoc(doc(as(null), "shares/existing01")));
      await assertSucceeds(getDoc(doc(as("free"), "shares/existing01")));
    });

    it("can't be listed, except your own", async () => {
      await assertFails(getDocs(collection(as(null), "shares")));
      await assertFails(getDocs(collection(as("other"), "shares")));
      await assertFails(getDocs(query(collection(as("other"), "shares"), where("owner", "==", "pro"))));
      await assertSucceeds(getDocs(query(collection(as("pro"), "shares"), where("owner", "==", "pro"))));
    });

    it("can't be edited; only the owner deletes", async () => {
      await assertFails(updateDoc(doc(as("pro"), "shares/existing01"), { title: "changed" }));
      await assertFails(deleteDoc(doc(as("other"), "shares/existing01")));
      await assertFails(deleteDoc(doc(as(null), "shares/existing01")));
      await assertSucceeds(deleteDoc(doc(as("pro"), "shares/existing01")));
    });
  });

  describe("synced data (unchanged)", () => {
    it("stays private to its owner", async () => {
      const item = { t: 1, data: "{}" };
      await assertSucceeds(setDoc(doc(as("alice"), "users/alice/recipes/r1"), item));
      await assertSucceeds(getDoc(doc(as("alice"), "users/alice/recipes/r1")));
      await assertFails(getDoc(doc(as("bob"), "users/alice/recipes/r1")));
      await assertFails(setDoc(doc(as("bob"), "users/alice/recipes/r2"), item));
      await assertFails(setDoc(doc(as("alice"), "users/alice/other/x"), item));
    });
  });
});
