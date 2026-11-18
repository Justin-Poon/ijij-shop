// POST /api/stripe-webhook
// Stripe calls this after payment. Subscribe to:
//   checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded

import type { Env } from "../../src/env.ts";
import { getCheckoutSession, verifyWebhook } from "../../src/stripe.ts";
import { fulfil } from "../../src/fulfil.ts";
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
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      // Re-fetch with line items so we know whether the upgrade was bought.
      const session = await getCheckoutSession(env, event.data.object.id);
      await fulfil(env, session); // throws -> 500 -> Stripe retries
      break;
    }
    case "charge.refunded": {
      const pi = event.data.object.payment_intent;
      if (pi) {
        const now = new Date().toISOString();
        await env.DB.prepare(`UPDATE orders SET refunded_at = ? WHERE payment_intent = ? AND refunded_at IS NULL`).bind(now, pi).run();
        // Stop the download link working.
        await env.DB.prepare(
          `UPDATE download_tokens SET expires_at = ? WHERE order_id IN (SELECT id FROM orders WHERE payment_intent = ?)`,
        ).bind(now, pi).run();
      }
      break;
    }
  }
  return json({ received: true });
};
