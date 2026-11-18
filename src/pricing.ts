// Works out what a buyer pays. Always computed on the server from Stripe's own prices,
// so nothing the browser sends can change the amount charged.

import type { Env } from "./env.ts";
import { findPromotionCode, getPrice, type PromotionCode } from "./stripe.ts";

// Stripe's minimum card charge is about 50c; below that we can't take a payment.
export const MIN_CHARGE = 50;

export interface Quote {
  currency: string;
  bundle: number;
  upgrade: number; // price of the 21-day add-on (0 if not chosen)
  subtotal: number;
  discount: number;
  total: number;
  code: string | null; // the code that was applied, as Stripe has it
  codeError: string | null; // why a typed code wasn't applied
}

/** Pure discount maths, split out so it can be unit tested. */
export function applyPromotion(subtotal: number, currency: string, promo: PromotionCode | null, now = Date.now() / 1000): { discount: number; error: string | null } {
  if (!promo) return { discount: 0, error: "That code isn't valid." };
  const c = promo.coupon;
  if (!promo.active || !c.valid) return { discount: 0, error: "That code isn't active." };
  if (promo.expires_at && promo.expires_at < now) return { discount: 0, error: "That code has expired." };
  if (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions) return { discount: 0, error: "That code has been used up." };
  const min = promo.restrictions?.minimum_amount;
  if (min && subtotal < min) return { discount: 0, error: "Your order is below this code's minimum." };

  let discount = 0;
  if (c.percent_off) discount = Math.round((subtotal * c.percent_off) / 100);
  else if (c.amount_off) {
    if (c.currency && c.currency.toLowerCase() !== currency.toLowerCase()) return { discount: 0, error: "That code isn't valid for this currency." };
    discount = c.amount_off;
  }
  discount = Math.min(discount, subtotal);
  if (subtotal - discount < MIN_CHARGE) return { discount: 0, error: "That code can't be used on this order." };
  return { discount, error: null };
}

export async function quote(env: Env, opts: { upgrade: boolean; code?: string | null }): Promise<Quote> {
  const [bundlePrice, upgradePrice] = await Promise.all([getPrice(env, env.STRIPE_PRICE_BUNDLE), getPrice(env, env.STRIPE_PRICE_UPGRADE)]);
  const currency = bundlePrice.currency;
  const bundle = bundlePrice.unit_amount ?? 0;
  const upgrade = opts.upgrade ? (upgradePrice.unit_amount ?? 0) : 0;
  const subtotal = bundle + upgrade;

  const typed = opts.code?.trim();
  if (!typed) return { currency, bundle, upgrade, subtotal, discount: 0, total: subtotal, code: null, codeError: null };

  const promo = /^[A-Za-z0-9_-]{2,40}$/.test(typed) ? await findPromotionCode(env, typed) : null;
  const { discount, error } = applyPromotion(subtotal, currency, promo);
  return {
    currency,
    bundle,
    upgrade,
    subtotal,
    discount,
    total: subtotal - discount,
    code: error ? null : promo!.code,
    codeError: error,
  };
}
