// Traffic-source attribution and funnel events (views, checkout starts).
// Purchases come from the orders table, which records the source too.

import type { Env } from "./env.ts";

const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|uptime/i;

/** Clean up a source label so the stats table stays tidy. */
export function normaliseSource(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().slice(0, 60);
  if (!s) return null;
  if (/^(ig|insta|instagram)$/.test(s)) return "instagram";
  if (/^(tt|tiktok|tik-tok)$/.test(s)) return "tiktok";
  if (/^(fb|facebook)$/.test(s)) return "facebook";
  if (/^(yt|youtube)$/.test(s)) return "youtube";
  if (/^(pin|pinterest)$/.test(s)) return "pinterest";
  if (/^(email|newsletter|kit)$/.test(s)) return "email";
  if (s === "direct") return "direct";
  if (s.startsWith("other:")) return s;
  return /^[a-z0-9._-]+$/.test(s) ? s : null;
}

/**
 * Work out where a visitor came from. Priority: an explicit ?src= / utm_source the browser
 * passes on, then the in-app browser (TikTok and Instagram identify themselves), then the referrer.
 */
export function detectSource(opts: { src?: string | null; userAgent?: string | null; referrer?: string | null }): string {
  const explicit = normaliseSource(opts.src);
  if (explicit) return explicit;
  const ua = opts.userAgent ?? "";
  if (/musical_ly|bytedance|tiktok|trill_/i.test(ua)) return "tiktok";
  if (/instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  let host = "";
  try {
    host = opts.referrer ? new URL(opts.referrer).hostname.replace(/^www\./, "") : "";
  } catch {}
  if (!host) return "direct";
  if (/(^|\.)tiktok\.com$/.test(host)) return "tiktok";
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(host)) return "facebook";
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return "youtube";
  if (/(^|\.)pinterest\./.test(host)) return "pinterest";
  if (/(^|\.)(google|bing|duckduckgo)\./.test(host)) return "search";
  return `other:${host.slice(0, 50)}`;
}

export function isBot(userAgent: string | null): boolean {
  return !userAgent || BOT_RE.test(userAgent);
}

/** Calendar day in Melbourne time, so "today" matches the owner's day. */
export function melbourneDay(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function cleanVisitor(v: unknown): string | null {
  return typeof v === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(v) ? v : null;
}

export function cleanCampaign(v: unknown): string | null {
  return typeof v === "string" && /^[a-zA-Z0-9 ._-]{1,60}$/.test(v) ? v.trim() : null;
}

export async function recordEvent(env: Env, e: { event: "view" | "checkout"; source: string; visitor: string | null; campaign: string | null }) {
  const now = new Date();
  await env.DB.prepare(`INSERT INTO events (ts, day, event, source, visitor, campaign) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(now.toISOString(), melbourneDay(now), e.event, e.source, e.visitor, e.campaign)
    .run();
}

/** Per-IP rate limit using a Workers rate-limiting binding. Allows everything if the binding isn't set up. */
export async function allowed(limiter: RateLimit | undefined, request: Request, bucket: string): Promise<boolean> {
  if (!limiter) return true;
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const { success } = await limiter.limit({ key: `${bucket}:${ip}` });
  return success;
}

export const TURNSTILE_ACTION = "checkout";

/**
 * Check a Cloudflare Turnstile token with Siteverify (canonical checks: success, expected action,
 * and an approved frontend hostname). Skipped when TURNSTILE_SECRET isn't set (local dev).
 */
export async function turnstileOk(env: Env, token: unknown, request: Request, action: string = TURNSTILE_ACTION): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  const expectedHostnames = new Set(
    (env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
  );
  if (typeof token !== "string" || token.length === 0 || token.length > 2048 || expectedHostnames.size === 0) return false;

  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) body.set("remoteip", ip);
  let result: { success?: boolean; action?: string; hostname?: string; "error-codes"?: string[] };
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(10_000),
      body,
    });
    if (!r.ok) throw new Error(`siteverify ${r.status}`);
    result = await r.json();
  } catch (err) {
    console.error("turnstile siteverify failed", err);
    return false;
  }
  const ok = result.success === true && result.action === action && !!result.hostname && expectedHostnames.has(result.hostname);
  if (!ok) console.warn("turnstile rejected", { action: result.action, hostname: result.hostname, errors: result["error-codes"] });
  return ok;
}
