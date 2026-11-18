// POST /api/checkout  (form post from the sales page)
// Field `upgrade=1` adds the 21-day planner upgrade. Redirects to Stripe Checkout.

import type { Env } from "../../src/env.ts";
import { createCheckoutSession, StripeError } from "../../src/stripe.ts";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const form = await request.formData().catch(() => new FormData());
  const upgrade = form.get("upgrade") === "1";

  const line_items: { price: string; quantity: number }[] = [{ price: env.STRIPE_PRICE_BUNDLE, quantity: 1 }];
  if (upgrade) line_items.push({ price: env.STRIPE_PRICE_UPGRADE, quantity: 1 });

  try {
    const session = await createCheckoutSession(env, {
      mode: "payment",
      line_items,
      allow_promotion_codes: true,
      customer_creation: "always",
      success_url: `${env.SITE_URL}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.SITE_URL}/?cancelled=1`,
      metadata: { product: "guide-bundle", upgrade: upgrade ? "21" : "14" },
    });
    return Response.redirect(session.url, 303);
  } catch (err) {
    console.error("checkout failed", err);
    const msg = err instanceof StripeError ? "Checkout is unavailable right now. Please try again in a minute." : "Something went wrong.";
    return new Response(msg, { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
};
