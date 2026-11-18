// GET /api/products -> current prices from Stripe, so the sales page never shows a stale price.

import type { Env } from "../../src/env.ts";
import { getPrice } from "../../src/stripe.ts";
import { formatMoney, json } from "../../src/util.ts";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  // The cache is only a speed-up: if it's unavailable, go straight to Stripe.
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(new URL("/api/products", request.url).toString());
  const hit = await cache.match(cacheKey).catch(() => undefined);
  if (hit) return hit;

  try {
    const [bundle, upgrade] = await Promise.all([getPrice(env, env.STRIPE_PRICE_BUNDLE), getPrice(env, env.STRIPE_PRICE_UPGRADE)]);
    const shape = (p: typeof bundle) => ({
      amount: p.unit_amount ?? 0,
      currency: p.currency,
      display: formatMoney(p.unit_amount ?? 0, p.currency),
    });
    const res = json({ bundle: shape(bundle), upgrade: shape(upgrade) }, 200, { "Cache-Control": "public, max-age=300" });
    waitUntil(cache.put(cacheKey, res.clone()).catch(() => {}));
    return res;
  } catch (err) {
    console.error("price lookup failed", err);
    return json({ error: "prices unavailable" }, 502);
  }
};
