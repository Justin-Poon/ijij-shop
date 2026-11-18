// Turns a paid Checkout session into an order, a download link and a delivery email.
// Safe to call more than once for the same session: the webhook and the thank-you page
// both call it, whichever arrives first does the work.

import type { Env } from "./env.ts";
import type { CheckoutSession } from "./stripe.ts";
import { sendDeliveryEmail } from "./email.ts";
import { randomToken } from "./util.ts";

export interface OrderRow {
  id: string;
  email: string;
  name: string | null;
  has_21: number;
  amount_total: number;
  currency: string;
  discount: number;
  payment_intent: string | null;
  created_at: string;
  emailed_at: string | null;
  refunded_at: string | null;
}

export interface Delivery {
  order: OrderRow;
  downloadUrl: string;
  planners: { label: string; url: string }[];
}

export function isPaid(session: CheckoutSession): boolean {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

export function boughtUpgrade(session: CheckoutSession, upgradePriceId: string): boolean {
  return (session.line_items?.data ?? []).some((li) => li.price?.id === upgradePriceId);
}

export function plannersFor(env: Env, has21: boolean) {
  const list = [{ label: "14-day Japan planner (Canva template)", url: env.PLANNER_14_URL }];
  if (has21) list.push({ label: "21-day Japan planner (Canva template)", url: env.PLANNER_21_URL });
  return list;
}

export async function issueDownloadToken(env: Env, orderId: string): Promise<string> {
  const token = randomToken();
  const days = Number(env.DOWNLOAD_DAYS || "60");
  const now = new Date();
  const expires = new Date(now.getTime() + days * 86400_000);
  await env.DB.prepare(
    `INSERT INTO download_tokens (token, order_id, file_key, expires_at, max_downloads, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(token, orderId, env.GUIDE_KEY, expires.toISOString(), Number(env.DOWNLOAD_MAX || "15"), now.toISOString())
    .run();
  return token;
}

async function latestToken(env: Env, orderId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT token FROM download_tokens WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(orderId)
    .first<{ token: string }>();
  return row?.token ?? null;
}

export function downloadUrl(env: Env, token: string) {
  return `${env.SITE_URL}/download/${token}`;
}

/**
 * Record the order (once), make sure it has a download link, and send the email (once).
 * Returns null if the session isn't paid yet.
 */
export async function fulfil(env: Env, session: CheckoutSession): Promise<Delivery | null> {
  if (!isPaid(session)) return null;
  const email = session.customer_details?.email;
  if (!email) throw new Error(`Session ${session.id} has no customer email`);

  const has21 = boughtUpgrade(session, env.STRIPE_PRICE_UPGRADE);
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO orders (id, email, name, has_21, amount_total, currency, discount, payment_intent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      session.id,
      email.toLowerCase(),
      session.customer_details?.name ?? null,
      has21 ? 1 : 0,
      session.amount_total ?? 0,
      session.currency ?? "aud",
      session.total_details?.amount_discount ?? 0,
      session.payment_intent ?? null,
      new Date().toISOString(),
    )
    .run();

  // Only the call that created the order creates its first token.
  let token = inserted.meta.changes === 1 ? await issueDownloadToken(env, session.id) : await latestToken(env, session.id);
  if (!token) token = await issueDownloadToken(env, session.id);

  const order = (await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(session.id).first<OrderRow>())!;
  const delivery: Delivery = {
    order,
    downloadUrl: downloadUrl(env, token),
    planners: plannersFor(env, order.has_21 === 1),
  };

  if (!order.emailed_at) {
    // Claim the send so a concurrent call doesn't send a second copy.
    const claimed = await env.DB.prepare(`UPDATE orders SET emailed_at = ? WHERE id = ? AND emailed_at IS NULL`)
      .bind(new Date().toISOString(), order.id)
      .run();
    if (claimed.meta.changes === 1) {
      try {
        await sendDeliveryEmail(env, delivery);
      } catch (err) {
        // Release the claim so Stripe's webhook retry (or a resend) can try again.
        await env.DB.prepare(`UPDATE orders SET emailed_at = NULL WHERE id = ?`).bind(order.id).run();
        throw err;
      }
    }
  }
  return delivery;
}
