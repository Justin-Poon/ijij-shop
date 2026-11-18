// POST /api/stripe-webhook
// Stripe calls this after payment. Subscribe to: payment_intent.succeeded, charge.refunded

import type { Env } from "../../src/env.ts";
import { getPaymentIntent, verifyWebhook } from "../../src/stripe.ts";
import { fulfil, purchaseFromIntent } from "../../src/fulfil.ts";
import { json } from "../../src/util.ts";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const payload = await request.text();
  let event: any;
  try {
    event = await verifyWebhook(payload, request.headers.get("Stripe-Signature"), env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.warn("webhook rejected:", (err as Error).message);
    return json({ error: "invalid signature" }, 400);
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      // Re-fetch rather than trusting the event body's copy.
      const pi = await getPaymentIntent(env, event.data.object.id);
      const purchase = purchaseFromIntent(pi);
      if (purchase) await fulfil(env, purchase); // throws -> 500 -> Stripe retries
      break;
    }
    case "charge.refunded": {
      const pi = event.data.object.payment_intent;
      if (pi) {
        const now = new Date().toISOString();
        await env.DB.prepare(`UPDATE orders SET refunded_at = ? WHERE id = ? AND refunded_at IS NULL`).bind(now, pi).run();
        // Stop the download links working.
        await env.DB.prepare(`UPDATE download_tokens SET expires_at = ? WHERE order_id = ?`).bind(now, pi).run();
      }
      break;
    }
  }
  return json({ received: true });
};
