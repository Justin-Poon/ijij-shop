// POST /api/admin/resend   Authorization: Bearer <ADMIN_TOKEN>
// Body: {"email": "customer@example.com"}
// Issues a fresh download link for the customer's latest order and emails it again.

import type { Env } from "../../../src/env.ts";
import { downloadUrl, issueDownloadToken, plannersFor, type OrderRow } from "../../../src/fulfil.ts";
import { sendDeliveryEmail } from "../../../src/email.ts";
import { json } from "../../../src/util.ts";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = request.headers.get("Authorization") ?? "";
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: "unauthorised" }, 401);

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) return json({ error: "email required" }, 400);

  const order = await env.DB.prepare(
    `SELECT * FROM orders WHERE email = ? AND refunded_at IS NULL ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(email)
    .first<OrderRow>();
  if (!order) return json({ error: "no paid order for that email" }, 404);

  const token = await issueDownloadToken(env, order.id);
  const delivery = { order, downloadUrl: downloadUrl(env, token), planners: plannersFor(env, order.has_21 === 1) };
  await sendDeliveryEmail(env, delivery);
  return json({ sent: true, order: order.id, downloadUrl: delivery.downloadUrl });
};
