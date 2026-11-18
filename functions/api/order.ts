// GET /api/order?session_id=cs_...
// Used by the thank-you page. Fulfils the order here too, in case the webhook is slow.

import type { Env } from "../../src/env.ts";
import { getCheckoutSession, StripeError } from "../../src/stripe.ts";
import { fulfil } from "../../src/fulfil.ts";
import { json } from "../../src/util.ts";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const id = new URL(request.url).searchParams.get("session_id") ?? "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json({ error: "bad session id" }, 400);

  try {
    const session = await getCheckoutSession(env, id);
    const delivery = await fulfil(env, session);
    if (!delivery) return json({ status: "pending" }, 202);
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
