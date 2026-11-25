// POST /api/intent {name, email, marketing, upgrade, code, source, visitor, campaign, turnstile}
// Creates the Stripe PaymentIntent for the on-page checkout. The browser then confirms it
// with Stripe.js. The amount is always worked out here, never taken from the browser.

import type { Env } from "../../src/env.ts";
import { quote } from "../../src/pricing.ts";
import { createPaymentIntent, StripeError } from "../../src/stripe.ts";
import { json } from "../../src/util.ts";
import { allowed, cleanCampaign, cleanVisitor, detectSource, normaliseSource, recordEvent, turnstileOk, cleanVariant } from "../../src/analytics.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = (await request.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    marketing?: boolean;
    upgrade?: boolean;
    code?: string;
    source?: string;
    visitor?: string;
    campaign?: string;
    variant?: string;
    turnstile?: string;
  };
  // Slow down card-testing bots: a few attempts per minute per visitor, plus a human check.
  if (!(await allowed(env.CHECKOUT_LIMITER, request, "intent"))) return json({ error: "Too many attempts. Please wait a minute and try again." }, 429);
  if (!(await turnstileOk(env, b.turnstile, request))) return json({ error: "Please complete the quick check above the Purchase button.", turnstile: true }, 403);
  const name = (b.name ?? "").trim().slice(0, 120);
  const email = (b.email ?? "").trim().toLowerCase();
  if (!name) return json({ error: "Please enter your name." }, 400);
  if (!EMAIL_RE.test(email) || email.length > 200) return json({ error: "Please enter a valid email." }, 400);

  const source =
    normaliseSource(b.source) ?? detectSource({ userAgent: request.headers.get("User-Agent"), referrer: request.headers.get("Referer") });
  const visitor = cleanVisitor(b.visitor);
  const campaign = cleanCampaign(b.campaign);
  const variant = cleanVariant(b.variant);

  try {
    const q = await quote(env, { upgrade: !!b.upgrade, code: b.code });
    if (b.code?.trim() && q.codeError) return json({ error: q.codeError }, 400);

    const pi = await createPaymentIntent(env, {
      amount: q.total,
      currency: q.currency,
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
      description: q.upgrade ? "Japan guide + 14 & 21-day planners" : "Japan guide + 14-day planner",
      metadata: {
        product: "guide-bundle",
        name,
        email,
        upgrade: q.upgrade ? "1" : "0",
        marketing: b.marketing ? "1" : "0",
        promo_code: q.code ?? "",
        discount: String(q.discount),
        source,
        visitor: visitor ?? "",
        campaign: campaign ?? "",
        variant: variant ?? "",
      },
    });
    await recordEvent(env, { event: "checkout", source, visitor, campaign, variant }).catch((e) => console.error("event failed", e));
    return json({ clientSecret: pi.client_secret, amount: q.total, currency: q.currency });
  } catch (err) {
    console.error("intent failed", err);
    const msg = err instanceof StripeError ? "Payments are unavailable right now. Please try again in a minute." : "Something went wrong.";
    return json({ error: msg }, 502);
  }
};
