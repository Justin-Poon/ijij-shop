// Worker entry point. Static pages come from public/ (the ASSETS binding);
// these routes run the handlers in functions/.

import type { Env } from "./env.ts";
import { onRequestGet as config } from "../functions/api/config.ts";
import { onRequestPost as quote } from "../functions/api/quote.ts";
import { onRequestPost as intent } from "../functions/api/intent.ts";
import { onRequestGet as order } from "../functions/api/order.ts";
import { onRequestPost as webhook } from "../functions/api/stripe-webhook.ts";
import { onRequestPost as resend } from "../functions/api/admin/resend.ts";
import { onRequestGet as stats } from "../functions/api/admin/stats.ts";
import { onRequestPost as track } from "../functions/api/track.ts";
import { onRequestPost as submitReview } from "../functions/api/review.ts";
import { onRequestGet as publicReviews } from "../functions/api/reviews.ts";
import { onRequestGet as adminReviews, onRequestPost as moderateReview } from "../functions/api/admin/reviews.ts";
import { onRequestPost as joinWaitlist } from "../functions/api/waitlist.ts";
import { onRequestGet as adminWaitlist } from "../functions/api/admin/waitlist.ts";
import { onRequestGet as adminBio, onRequestPost as adminBioPost } from "../functions/api/admin/bio.ts";
import { onRequestGet as download } from "../functions/download/[token].ts";

type Handler = (ctx: any) => Response | Promise<Response>;

const ROUTES: [method: string, path: string | RegExp, handler: Handler][] = [
  ["GET", "/api/config", config],
  ["POST", "/api/quote", quote],
  ["POST", "/api/intent", intent],
  ["GET", "/api/order", order],
  ["POST", "/api/stripe-webhook", webhook],
  ["POST", "/api/admin/resend", resend],
  ["GET", "/api/admin/stats", stats],
  ["POST", "/api/track", track],
  ["POST", "/api/review", submitReview],
  ["GET", "/api/reviews", publicReviews],
  ["GET", "/api/admin/reviews", adminReviews],
  ["POST", "/api/admin/reviews", moderateReview],
  ["POST", "/api/waitlist", joinWaitlist],
  ["GET", "/api/admin/waitlist", adminWaitlist],
  ["GET", "/api/admin/bio", adminBio],
  ["POST", "/api/admin/bio", adminBioPost],
  ["GET", /^\/download\/([^/]+)$/, download],
];

export default {
  async fetch(request: Request, env: Env & { ASSETS: Fetcher }, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    // The shop lives on its own domain; send the old workers.dev address there (Turnstile only allows the real domain).
    if (url.hostname.endsWith(".workers.dev") && env.SITE_URL && !env.SITE_URL.includes(".workers.dev")) {
      return Response.redirect(env.SITE_URL + pathname + url.search, 301);
    }
    const allow: string[] = [];
    for (const [method, path, handler] of ROUTES) {
      const match = typeof path === "string" ? (pathname === path ? [] : null) : pathname.match(path);
      if (!match) continue;
      if (request.method !== method) {
        allow.push(method);
        continue;
      }
      const params = typeof path === "string" ? {} : { token: match[1] };
      return handler({ request, env, params, waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p) });
    }
    if (allow.length) return new Response("Method not allowed", { status: 405, headers: { Allow: allow.join(", ") } });
    return env.ASSETS.fetch(request);
  },
};
