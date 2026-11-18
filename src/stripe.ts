// Minimal Stripe client using fetch. No SDK, so nothing to break on the Workers runtime.

export interface StripeConfig {
  STRIPE_SECRET_KEY: string;
  STRIPE_API_BASE?: string;
}

// Pinned so response shapes (e.g. promotion codes) don't change under us when Stripe
// releases a new API version.
export const STRIPE_API_VERSION = "2024-06-20";

export interface PaymentIntent {
  id: string;
  object: "payment_intent";
  amount: number;
  currency: string;
  status: string; // "succeeded" when paid
  client_secret: string;
  receipt_email: string | null;
  metadata: Record<string, string>;
}

export interface Coupon {
  id: string;
  valid: boolean;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
}

export interface PromotionCode {
  id: string;
  code: string;
  active: boolean;
  expires_at: number | null;
  max_redemptions: number | null;
  times_redeemed: number;
  coupon: Coupon;
  restrictions?: { minimum_amount: number | null; minimum_amount_currency: string | null };
}

export interface Price {
  id: string;
  unit_amount: number | null;
  currency: string;
  active: boolean;
}

/** Encode nested params the way Stripe expects: a[b][0][c]=d */
export function encodeForm(params: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === "object") {
          parts.push(encodeForm(item as Record<string, unknown>, `${name}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof value === "object") {
      parts.push(encodeForm(value as Record<string, unknown>, name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

export class StripeError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(cfg: StripeConfig, method: "GET" | "POST", path: string, params?: Record<string, unknown>): Promise<T> {
  const base = cfg.STRIPE_API_BASE || "https://api.stripe.com";
  let url = `${base}/v1/${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${cfg.STRIPE_SECRET_KEY}`,
      "Stripe-Version": STRIPE_API_VERSION,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (params) {
    const body = encodeForm(params);
    if (method === "GET") url += `?${body}`;
    else init.body = body;
  }
  const res = await fetch(url, init);
  const data = (await res.json()) as any;
  if (!res.ok) {
    throw new StripeError(data?.error?.message || `Stripe ${res.status}`, res.status);
  }
  return data as T;
}

export function createPaymentIntent(cfg: StripeConfig, params: Record<string, unknown>) {
  return call<PaymentIntent>(cfg, "POST", "payment_intents", params);
}

export function getPaymentIntent(cfg: StripeConfig, id: string) {
  return call<PaymentIntent>(cfg, "GET", `payment_intents/${encodeURIComponent(id)}`);
}

/** Look up an active promotion code (what customers type, e.g. JAPLAN10). */
export async function findPromotionCode(cfg: StripeConfig, code: string): Promise<PromotionCode | null> {
  const res = await call<{ data: PromotionCode[] }>(cfg, "GET", "promotion_codes", { code, active: true, limit: 1 });
  return res.data[0] ?? null;
}

export function getPrice(cfg: StripeConfig, id: string) {
  return call<Price>(cfg, "GET", `prices/${encodeURIComponent(id)}`);
}

// ---- Webhook signature verification -------------------------------------------------

const enc = new TextEncoder();

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Build a Stripe-Signature header. Used by tests and the local mock. */
export async function signPayload(secret: string, payload: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${payload}`)}`;
}

/**
 * Check a webhook's Stripe-Signature header against the raw body.
 * Returns the parsed event, or throws if the signature is missing, wrong or too old.
 */
export async function verifyWebhook<T = any>(
  payload: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
): Promise<T> {
  if (!header) throw new Error("Missing Stripe-Signature header");
  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = Number(v);
    if (k === "v1" && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) throw new Error("Malformed Stripe-Signature header");
  if (Math.abs(now - timestamp) > toleranceSeconds) throw new Error("Webhook timestamp outside tolerance");
  const expected = await hmacHex(secret, `${timestamp}.${payload}`);
  if (!signatures.some((s) => safeEqual(s, expected))) throw new Error("Webhook signature mismatch");
  return JSON.parse(payload) as T;
}
