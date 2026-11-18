// Worker entry point. Static pages come from public/ (the ASSETS binding);
// these routes run the handlers in functions/.

import type { Env } from "./env.ts";
import { onRequestGet as config } from "../functions/api/config.ts";
import { onRequestPost as quote } from "../functions/api/quote.ts";
import { onRequestPost as intent } from "../functions/api/intent.ts";
import { onRequestGet as order } from "../functions/api/order.ts";
import { onRequestPost as webhook } from "../functions/api/stripe-webhook.ts";
import { onRequestPost as resend } from "../functions/api/admin/resend.ts";
import { onRequestGet as download } from "../functions/download/[token].ts";

type Handler = (ctx: any) => Response | Promise<Response>;

const ROUTES: [method: string, path: string | RegExp, handler: Handler][] = [
  ["GET", "/api/config", config],
  ["POST", "/api/quote", quote],
  ["POST", "/api/intent", intent],
  ["GET", "/api/order", order],
  ["POST", "/api/stripe-webhook", webhook],
  ["POST", "/api/admin/resend", resend],
  ["GET", /^\/download\/([^/]+)$/, download],
];

export default {
  async fetch(request: Request, env: Env & { ASSETS: Fetcher }, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    for (const [method, path, handler] of ROUTES) {
      const match = typeof path === "string" ? (pathname === path ? [] : null) : pathname.match(path);
      if (!match) continue;
      if (request.method !== method) return new Response("Method not allowed", { status: 405, headers: { Allow: method } });
      const params = typeof path === "string" ? {} : { token: match[1] };
      return handler({ request, env, params, waitUntil: (p: Promise<unknown>) => ctx.waitUntil(p) });
    }
    return env.ASSETS.fetch(request);
  },
};
