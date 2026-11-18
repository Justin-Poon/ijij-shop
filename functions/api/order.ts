// GET /api/order?payment_intent=pi_...&payment_intent_client_secret=...
// Used by the thank-you page (Stripe adds both params to the return URL).
// The client secret proves the caller is the buyer. Fulfils here too, in case the webhook is slow.

import type { Env } from "../../src/env.ts";
import { getPaymentIntent, StripeError } from "../../src/stripe.ts";
import { fulfil, purchaseFromIntent } from "../../src/fulfil.ts";
import { json } from "../../src/util.ts";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams;
  const id = q.get("payment_intent") ?? "";
  const secret = q.get("payment_intent_client_secret") ?? "";
  if (!/^pi_[A-Za-z0-9_]+$/.test(id) || !secret) return json({ error: "bad request" }, 400);

  try {
    const pi = await getPaymentIntent(env, id);
    if (pi.client_secret !== secret) return json({ error: "not found" }, 404);

    if (pi.status === "processing") return json({ status: "pending" }, 202);
    const purchase = purchaseFromIntent(pi);
    if (!purchase) return json({ status: "failed" }, 402);

    const delivery = await fulfil(env, purchase);
    if (delivery.order.refunded_at) return json({ status: "refunded" }, 410);
    return json({
      status: "paid",
      email: delivery.order.email,
      downloadUrl: delivery.downloadUrl,
      planners: delivery.planners,
    });
  } catch (err) {
    if (err instanceof StripeError && err.status === 404) return json({ error: "not found" }, 404);
    console.error("order lookup failed", err);
    return json({ error: "server error" }, 500);
  }
};
