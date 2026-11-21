// POST /api/review {name, email, stars, text, consent, turnstile}
// Saves a customer review as 'pending'. Nothing appears on the shop until the owner approves it in /admin.
// If the email matches a paid, unrefunded order, the review is marked as from a verified buyer.

import type { Env } from "../../src/env.ts";
import { allowed, turnstileOk } from "../../src/analytics.ts";
import { validateReview } from "../../src/reviews.ts";
import { json } from "../../src/util.ts";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await allowed(env.CHECKOUT_LIMITER, request, "review"))) return json({ error: "Too many tries. Please wait a minute and try again." }, 429);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const v = validateReview(body);
  if (!v.ok) return json({ error: v.error }, 400);
  if (!(await turnstileOk(env, body?.turnstile, request, "review"))) {
    return json({ error: "Please complete the quick check above the button.", turnstile: true }, 403);
  }

  const r = v.value;
  const order = await env.DB.prepare(`SELECT id FROM orders WHERE email = ? AND refunded_at IS NULL ORDER BY created_at DESC LIMIT 1`)
    .bind(r.email)
    .first<{ id: string }>();

  await env.DB.prepare(
    `INSERT INTO reviews (created_at, name, stars, text, email, order_id, verified, consent, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  )
    .bind(new Date().toISOString(), r.name, r.stars, r.text, r.email, order?.id ?? null, order ? 1 : 0, r.consent ? 1 : 0)
    .run();

  return json({ ok: true });
};
