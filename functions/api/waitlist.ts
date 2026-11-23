// POST /api/waitlist {email, name?, travel_month?, source?, consent, turnstile}
// Adds someone to the launch waitlist (or re-subscribes them). Same response whether or not they were
// already on it, so the form can't be used to check who's signed up.

import type { Env } from "../../src/env.ts";
import { allowed, turnstileOk } from "../../src/analytics.ts";
import { validateWaitlist } from "../../src/waitlist.ts";
import { json } from "../../src/util.ts";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await allowed(env.CHECKOUT_LIMITER, request, "waitlist"))) return json({ error: "Too many tries. Please wait a minute and try again." }, 429);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const v = validateWaitlist(body);
  if (!v.ok) return json({ error: v.error }, 400);
  if (!(await turnstileOk(env, body?.turnstile, request, "waitlist"))) {
    return json({ error: "Please complete the quick check above the button.", turnstile: true }, 403);
  }
  const w = v.value;
  await env.DB.prepare(
    `INSERT INTO waitlist (created_at, email, name, travel_month, source, consent) VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT(email) DO UPDATE SET name = COALESCE(excluded.name, name), travel_month = COALESCE(excluded.travel_month, travel_month),
       consent = 1, unsubscribed_at = NULL`,
  )
    .bind(new Date().toISOString(), w.email, w.name, w.travel_month, w.source)
    .run();
  return json({ ok: true });
};
