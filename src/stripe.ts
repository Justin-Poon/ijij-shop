// Minimal Stripe client using fetch. No SDK, so nothing to break on the Workers runtime.

export interface StripeConfig {
  STRIPE_SECRET_KEY: string;
  STRIPE_API_BASE?: string;
}

export interface CheckoutSession {
  id: string;
  status: string | null;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  amount_total: number | null;
  currency: string | null;
  payment_intent: string | null;
  customer_details: { email: string | null; name: string | null } | null;
  total_details?: { amount_discount: number } | null;
  line_items?: { data: { price: { id: string } | null; quantity: number | null }[] };
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

export function createCheckoutSession(cfg: StripeConfig, params: Record<string, unknown>) {
  return call<CheckoutSession & { url: string }>(cfg, "POST", "checkout/sessions", params);
}

export function getCheckoutSession(cfg: StripeConfig, id: string) {
  return call<CheckoutSession>(cfg, "GET", `checkout/sessions/${encodeURIComponent(id)}`, {
    expand: ["line_items"],
  });
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
