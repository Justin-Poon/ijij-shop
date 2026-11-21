// GET /api/config -> prices and the Stripe publishable key for the product page.

import type { Env } from "../../src/env.ts";
import { quote, upgradeAvailable } from "../../src/pricing.ts";
import { formatMoney, json } from "../../src/util.ts";
import { StripeError } from "../../src/stripe.ts";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  // The cache is only a speed-up: if it's unavailable, go straight to Stripe.
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(new URL("/api/config", request.url).toString());
  const hit = await cache.match(cacheKey).catch(() => undefined);
  if (hit) return hit;

  try {
    const q = await quote(env, { upgrade: true });
    const res = json(
      {
        publishableKey: env.STRIPE_PUBLISHABLE_KEY,
        // Only show the bot check once the server can verify it (secret set).
        turnstileSiteKey: env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY ? env.TURNSTILE_SITE_KEY : null,
        currency: q.currency,
        bundle: { amount: q.bundle, display: formatMoney(q.bundle, q.currency) },
        upgrade: { amount: q.upgrade, display: formatMoney(q.upgrade, q.currency), available: upgradeAvailable(env) },
      },
      200,
      { "Cache-Control": "public, max-age=300" },
    );
    waitUntil(cache.put(cacheKey, res.clone()).catch(() => {}));
    return res;
  } catch (err) {
    console.error("config failed", err);
    // Stripe's own message (keys are masked by Stripe) helps diagnose setup problems.
    const detail = err instanceof StripeError ? err.message : undefined;
    return json({ error: "unavailable", detail }, 502);
  }
};
