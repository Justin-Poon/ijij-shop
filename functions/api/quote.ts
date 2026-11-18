// POST /api/quote {upgrade, code} -> the total, with the discount code checked against Stripe.
// Powers the "Apply" button and the live total on the product page.

import type { Env } from "../../src/env.ts";
import { quote } from "../../src/pricing.ts";
import { formatMoney, json } from "../../src/util.ts";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as { upgrade?: boolean; code?: string };
  try {
    const q = await quote(env, { upgrade: !!body.upgrade, code: body.code });
    return json({ ...q, totalDisplay: formatMoney(q.total, q.currency), discountDisplay: formatMoney(q.discount, q.currency) });
  } catch (err) {
    console.error("quote failed", err);
    return json({ error: "unavailable" }, 502);
  }
};
