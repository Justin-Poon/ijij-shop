import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPromotion } from "../src/pricing.ts";
import type { PromotionCode } from "../src/stripe.ts";

const promo = (over: Partial<PromotionCode> = {}, coupon: Partial<PromotionCode["coupon"]> = {}): PromotionCode => ({
  id: "promo_1",
  code: "JAPLAN10",
  active: true,
  expires_at: null,
  max_redemptions: null,
  times_redeemed: 0,
  restrictions: { minimum_amount: null, minimum_amount_currency: null },
  ...over,
  coupon: { id: "c", valid: true, percent_off: 10, amount_off: null, currency: null, ...coupon },
});

test("percent off rounds to the nearest cent", () => {
  assert.deepEqual(applyPromotion(3900, "aud", promo()), { discount: 390, error: null });
  assert.deepEqual(applyPromotion(4999, "aud", promo()), { discount: 500, error: null });
});

test("amount off in the same currency", () => {
  assert.deepEqual(applyPromotion(3900, "aud", promo({}, { percent_off: null, amount_off: 500, currency: "aud" })), { discount: 500, error: null });
});

test("amount off in another currency is refused", () => {
  assert.equal(applyPromotion(3900, "aud", promo({}, { percent_off: null, amount_off: 500, currency: "usd" })).discount, 0);
});

test("unknown, inactive, expired and used-up codes give no discount", () => {
  assert.match(applyPromotion(3900, "aud", null).error!, /isn't valid/);
  assert.match(applyPromotion(3900, "aud", promo({ active: false })).error!, /active/);
  assert.match(applyPromotion(3900, "aud", promo({}, { valid: false })).error!, /active/);
  assert.match(applyPromotion(3900, "aud", promo({ expires_at: 100 }), 200).error!, /expired/);
  assert.match(applyPromotion(3900, "aud", promo({ max_redemptions: 5, times_redeemed: 5 })).error!, /used up/);
});

test("minimum order amounts are respected", () => {
  const p = promo({ restrictions: { minimum_amount: 4000, minimum_amount_currency: "aud" } });
  assert.match(applyPromotion(3900, "aud", p).error!, /minimum/);
  assert.equal(applyPromotion(4900, "aud", p).discount, 490);
});

test("a code can't bring the charge below Stripe's minimum", () => {
  assert.match(applyPromotion(3900, "aud", promo({}, { percent_off: 100 })).error!, /can't be used/);
});
