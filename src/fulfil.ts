// Turns a successful payment into an order, a download link and a delivery email.
// Safe to call more than once for the same payment: the webhook and the thank-you page
// both call it, whichever arrives first does the work.

import type { Env } from "./env.ts";
import type { PaymentIntent } from "./stripe.ts";
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
  promo_code: string | null;
  marketing: number;
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

/** What we need to record about a purchase. All of it is set by our server in metadata. */
export interface Purchase {
  id: string;
  email: string;
  name: string | null;
  has21: boolean;
  amount: number;
  currency: string;
  discount: number;
  promoCode: string | null;
  marketing: boolean;
}

/** Null if the payment hasn't succeeded (yet) or isn't one of ours. */
export function purchaseFromIntent(pi: PaymentIntent): Purchase | null {
  if (pi.status !== "succeeded") return null;
  const m = pi.metadata ?? {};
  if (m.product !== "guide-bundle") return null;
  const email = m.email || pi.receipt_email;
  if (!email) throw new Error(`PaymentIntent ${pi.id} has no email`);
  return {
    id: pi.id,
    email: email.toLowerCase(),
    name: m.name || null,
    has21: m.upgrade === "1",
    amount: pi.amount,
    currency: pi.currency,
    discount: Number(m.discount || 0),
    promoCode: m.promo_code || null,
    marketing: m.marketing === "1",
  };
}

export function plannersFor(env: Env, has21: boolean) {
  const list = [{ label: "14-day Japan planner (Canva template)", url: env.PLANNER_14_URL }];
  if (has21) list.push({ label: "21-day Japan planner (Canva template)", url: env.PLANNER_21_URL });
  // Never send a broken link: skip any planner whose URL isn't configured yet.
  return list.filter((p) => typeof p.url === "string" && /^https:\/\//.test(p.url));
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
 */
export async function fulfil(env: Env, p: Purchase): Promise<Delivery> {
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO orders (id, email, name, has_21, amount_total, currency, discount, promo_code, marketing, payment_intent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(p.id, p.email, p.name, p.has21 ? 1 : 0, p.amount, p.currency, p.discount, p.promoCode, p.marketing ? 1 : 0, p.id, new Date().toISOString())
    .run();

  // Only the call that created the order creates its first token.
  let token = inserted.meta.changes === 1 ? await issueDownloadToken(env, p.id) : await latestToken(env, p.id);
  if (!token) token = await issueDownloadToken(env, p.id);

  const order = (await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(p.id).first<OrderRow>())!;
  const delivery: Delivery = {
    order,
    downloadUrl: downloadUrl(env, token),
    planners: plannersFor(env, order.has_21 === 1),
  };

  if (!order.emailed_at && !order.refunded_at) {
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
