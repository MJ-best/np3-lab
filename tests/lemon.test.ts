import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkoutRequest, entitlementFromEvent, isUid, verifySignature } from "../functions/lemon.js";

const UID = "Abc123XYZ456def789GHI0jklmn1";
const sub = (attributes: Record<string, unknown>, event = "subscription_updated", custom: unknown = { uid: UID }) => ({
  meta: { event_name: event, custom_data: custom, test_mode: true },
  data: { type: "subscriptions", id: "42", attributes: { updated_at: "2026-11-05T10:00:00Z", ...attributes } },
});
const DAY = 24 * 60 * 60 * 1000;

describe("Lemon Squeezy webhooks", () => {
  it("accepts only bodies signed with the secret", () => {
    const body = Buffer.from(JSON.stringify(sub({ status: "active" })));
    const good = createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifySignature(body, good, "s3cret")).toBe(true);
    expect(verifySignature(body, good, "other")).toBe(false);
    expect(verifySignature(Buffer.from(body.toString() + " "), good, "s3cret")).toBe(false);
    expect(verifySignature(body, "zz", "s3cret")).toBe(false);
    expect(verifySignature(body, undefined, "s3cret")).toBe(false);
    expect(verifySignature(undefined, good, "s3cret")).toBe(false);
  });

  it("gives Pro until the renewal (plus grace) while active", () => {
    const e = entitlementFromEvent(sub({ status: "active", renews_at: "2027-11-05T00:00:00Z" }, "subscription_created"))!;
    expect(e).toMatchObject({ uid: UID, status: "active", subscriptionId: "42", testMode: true });
    expect(e.proUntil).toBe(Date.parse("2027-11-05T00:00:00Z") + 3 * DAY);
  });

  it("keeps Pro to the end of the paid period after cancelling, and ends it on expiry", () => {
    expect(entitlementFromEvent(sub({ status: "cancelled", ends_at: "2027-01-01T00:00:00Z" }))!.proUntil).toBe(Date.parse("2027-01-01T00:00:00Z"));
    expect(entitlementFromEvent(sub({ status: "expired", ends_at: "2027-01-01T00:00:00Z" }))!.proUntil).toBeNull();
    expect(entitlementFromEvent(sub({ status: "paused" }))!.proUntil).toBeNull();
  });

  it("ignores events it can't attribute or that aren't subscriptions", () => {
    expect(entitlementFromEvent(sub({ status: "active" }, "order_created"))).toBeNull();
    expect(entitlementFromEvent(sub({ status: "active" }, "subscription_updated", {}))).toBeNull();
    expect(entitlementFromEvent(sub({ status: "active" }, "subscription_updated", { uid: "../../etc" }))).toBeNull();
    const invoice = { ...sub({ status: "paid" }, "subscription_payment_success"), data: { type: "subscription-invoices", id: "9", attributes: {} } };
    expect(entitlementFromEvent(invoice)).toBeNull();
    expect(entitlementFromEvent(null)).toBeNull();
  });

  it("validates uids", () => {
    expect(isUid(UID)).toBe(true);
    for (const bad of ["", "short", "has/slash12345", 42, null]) expect(isUid(bad)).toBe(false);
  });
});

describe("checkout request", () => {
  it("carries the uid as custom data and limits checkout to the Pro variant", () => {
    const body = checkoutRequest({ storeId: 7, variantId: "99", uid: UID, email: "a@b.c", redirectUrl: "https://np3-lab.web.app/?pro=thanks" });
    expect(body.data.attributes.checkout_data).toEqual({ email: "a@b.c", custom: { uid: UID } });
    expect(body.data.attributes.product_options).toEqual({ redirect_url: "https://np3-lab.web.app/?pro=thanks", enabled_variants: [99] });
    expect(body.data.relationships).toEqual({ store: { data: { type: "stores", id: "7" } }, variant: { data: { type: "variants", id: "99" } } });
    expect(checkoutRequest({ storeId: 7, variantId: 1, uid: UID, redirectUrl: "x" }).data.attributes.checkout_data).toEqual({ custom: { uid: UID } });
  });
});
