// Lemon Squeezy (merchant of record for NP3 Lab Pro): checkout requests and webhook events.
// Pure functions, so they can be tested without Firebase or the network.
import { createHmac, timingSafeEqual } from "node:crypto";

export const LEMON_API = "https://api.lemonsqueezy.com/v1";

/** Firebase Auth uids are 28 characters today; accept a sane range of URL-safe ids. */
export const isUid = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{10,128}$/.test(v);

/**
 * Webhook signature: hex HMAC-SHA256 of the raw body with the signing secret, in X-Signature.
 * @param {Buffer | undefined} rawBody
 * @param {string | undefined} signature
 * @param {string} secret
 */
export function verifySignature(rawBody, signature, secret) {
  if (!rawBody || typeof signature !== "string" || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let given;
  try {
    given = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * JSON:API body for POST /v1/checkouts: the Pro variant, with the buyer's uid carried through to
 * the webhook as custom data and their email filled in.
 * @param {{ storeId: string | number, variantId: string | number, uid: string, email?: string, redirectUrl: string, testMode?: boolean }} opts
 */
export function checkoutRequest({ storeId, variantId, uid, email, redirectUrl, testMode = false }) {
  return {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: { ...(email ? { email } : {}), custom: { uid } },
        product_options: { redirect_url: redirectUrl, enabled_variants: [Number(variantId)] },
        checkout_options: { embed: false },
        ...(testMode ? { test_mode: true } : {}),
      },
      relationships: {
        store: { data: { type: "stores", id: String(storeId) } },
        variant: { data: { type: "variants", id: String(variantId) } },
      },
    },
  };
}

/** Renewal webhooks can arrive a little after the renewal date; Pro stays on meanwhile. */
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
const ACTIVE = new Set(["on_trial", "active", "past_due"]);
const SUBSCRIPTION_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
  "subscription_payment_success",
  "subscription_payment_failed",
  "subscription_payment_recovered",
]);

const ms = (v) => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};

/**
 * What a subscription webhook means for the buyer's Pro access, or null if it doesn't concern a
 * subscription we can attribute to a user.
 * - active / on trial / past due: until the next renewal (plus a grace period)
 * - cancelled: until the end of the paid period
 * - expired, unpaid, paused: not Pro
 */
export function entitlementFromEvent(event) {
  const name = event?.meta?.event_name;
  const uid = event?.meta?.custom_data?.uid;
  const sub = event?.data;
  if (!SUBSCRIPTION_EVENTS.has(name) || !isUid(uid)) return null;
  // Payment events carry an invoice, not the subscription; the subscription_updated that follows has the state.
  if (sub?.type !== "subscriptions") return null;
  const a = sub.attributes ?? {};
  const status = typeof a.status === "string" ? a.status : "unknown";
  let proUntil = null;
  if (ACTIVE.has(status)) {
    const renews = ms(a.renews_at);
    proUntil = renews === null ? null : renews + GRACE_MS;
  } else if (status === "cancelled") {
    proUntil = ms(a.ends_at);
  }
  return {
    uid,
    plan: "pro",
    status,
    proUntil,
    subscriptionId: String(sub.id ?? ""),
    testMode: event?.meta?.test_mode === true,
    // Webhooks may arrive out of order; the newest subscription state wins.
    sourceUpdatedAt: ms(a.updated_at) ?? 0,
  };
}
