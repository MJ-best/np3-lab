// Cloud Functions for NP3 Lab Pro (hosted web version). Payments are handled by Lemon Squeezy,
// which is the merchant of record; we only keep each user's Pro status in Firestore.
//
// Set up once (see README › Pro):
//   firebase functions:secrets:set LEMON_API_KEY
//   firebase functions:secrets:set LEMON_WEBHOOK_SECRET
//   LEMON_STORE_ID / LEMON_VARIANT_ID are asked for on the first deploy (or put in functions/.env).
import { initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { LEMON_API, checkoutRequest, entitlementFromEvent, isUid, verifySignature } from "./lemon.js";

const REGION = "asia-northeast3"; // Seoul, next to the Firestore database
const SITE = "https://np3-lab.web.app";

const LEMON_API_KEY = defineSecret("LEMON_API_KEY");
const LEMON_WEBHOOK_SECRET = defineSecret("LEMON_WEBHOOK_SECRET");
const LEMON_STORE_ID = defineString("LEMON_STORE_ID");
const LEMON_VARIANT_ID = defineString("LEMON_VARIANT_ID");

initializeApp();
const db = getFirestore();

const lemonHeaders = (key) => ({
  Accept: "application/vnd.api+json",
  "Content-Type": "application/vnd.api+json",
  Authorization: `Bearer ${key}`,
});

/** Signed-in user → a Lemon Squeezy checkout URL for Pro. */
export const createCheckout = onCall({ region: REGION, secrets: [LEMON_API_KEY] }, async (req) => {
  const uid = req.auth?.uid;
  if (!isUid(uid)) throw new HttpsError("unauthenticated", "sign-in-required");
  const lang = ["ko", "en", "ja"].includes(req.data?.lang) ? req.data.lang : "en";
  const body = checkoutRequest({
    storeId: LEMON_STORE_ID.value(),
    variantId: LEMON_VARIANT_ID.value(),
    uid,
    email: req.auth.token?.email,
    redirectUrl: `${SITE}/?pro=thanks&lang=${lang}`,
  });
  const res = await fetch(`${LEMON_API}/checkouts`, { method: "POST", headers: lemonHeaders(LEMON_API_KEY.value()), body: JSON.stringify(body) });
  if (!res.ok) {
    console.error("checkout failed", res.status, await res.text());
    throw new HttpsError("unavailable", "checkout-failed");
  }
  const url = (await res.json())?.data?.attributes?.url;
  if (typeof url !== "string" || !url.startsWith("https://")) throw new HttpsError("internal", "no-checkout-url");
  return { url };
});

/** Signed-in Pro user → their Lemon Squeezy customer portal (change card, cancel, invoices). */
export const manageSubscription = onCall({ region: REGION, secrets: [LEMON_API_KEY] }, async (req) => {
  const uid = req.auth?.uid;
  if (!isUid(uid)) throw new HttpsError("unauthenticated", "sign-in-required");
  const ent = (await db.doc(`entitlements/${uid}`).get()).data();
  if (!ent?.subscriptionId) throw new HttpsError("not-found", "no-subscription");
  // The portal URL is signed and short-lived, so it's fetched fresh each time.
  const res = await fetch(`${LEMON_API}/subscriptions/${encodeURIComponent(ent.subscriptionId)}`, { headers: lemonHeaders(LEMON_API_KEY.value()) });
  if (!res.ok) throw new HttpsError("unavailable", "portal-failed");
  const url = (await res.json())?.data?.attributes?.urls?.customer_portal;
  if (typeof url !== "string" || !url.startsWith("https://")) throw new HttpsError("internal", "no-portal-url");
  return { url };
});

/** Lemon Squeezy → us: subscription changes. Only signed requests are accepted. */
export const lemonWebhook = onRequest({ region: REGION, secrets: [LEMON_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  if (!verifySignature(req.rawBody, req.get("X-Signature"), LEMON_WEBHOOK_SECRET.value())) {
    res.status(401).end();
    return;
  }
  let event;
  try {
    event = JSON.parse(req.rawBody.toString("utf8"));
  } catch {
    res.status(400).end();
    return;
  }
  const e = entitlementFromEvent(event);
  if (!e) {
    res.status(200).send("ignored");
    return;
  }
  const ref = db.doc(`entitlements/${e.uid}`);
  await db.runTransaction(async (tx) => {
    const current = (await tx.get(ref)).data();
    // An older event arriving late must not undo a newer one.
    if (current && (current.sourceUpdatedAt ?? 0) > e.sourceUpdatedAt) return;
    tx.set(ref, {
      plan: e.plan,
      status: e.status,
      proUntil: e.proUntil === null ? null : Timestamp.fromMillis(e.proUntil),
      subscriptionId: e.subscriptionId,
      testMode: e.testMode,
      sourceUpdatedAt: e.sourceUpdatedAt,
      updatedAt: Timestamp.now(),
    });
  });
  res.status(200).send("ok");
});
