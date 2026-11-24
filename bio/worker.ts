// itsjustinjapan.com (bio link). Serves the static page and counts:
//   - views of the bio page (by source: Instagram / TikTok in-app browsers, ?src=, referrer; optional ?c= campaign)
//   - clicks on each outbound link (links are rewritten to /go/<label>, which logs and redirects)
// Events go to the shop's D1 database; the dashboard is on shop.itsjustinjapan.com/admin.

import { detectSource, isBot, melbourneDay, cleanCampaign } from "../src/analytics.ts";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
}

// Outbound links: label -> destination. Only these are redirected (no open redirect).
export const LINKS: Record<string, string> = {
  "etsy-14": "https://itsjustinjapan.etsy.com/listing/1614929414",
  "etsy-21": "https://itsjustinjapan.etsy.com/listing/1887588787",
  "gumroad-notion": "https://justinjapan.gumroad.com/l/notion-14-day-japan-guide/FIRST1000",
  "gumroad-solo": "https://justinjapan.gumroad.com/l/solo-women-japan-travel-kit/FIRST1000",
  waitlist: "https://shop.itsjustinjapan.com/waitlist?src=bio",
  newsletter: "https://itsjustinjapan.beehiiv.com/subscribe",
  instagram: "https://www.instagram.com/itsjustinjapan/",
  tiktok: "https://www.tiktok.com/@itsjustinjapan",
};
const LABEL_BY_URL = new Map(Object.entries(LINKS).map(([k, v]) => [v, k]));

async function visitorId(env: Env, request: Request, day: string): Promise<string | null> {
  try {
    let row = await env.DB.prepare(`SELECT salt FROM bio_salts WHERE day = ?`).bind(day).first<{ salt: string }>();
    if (!row) {
      const salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
      await env.DB.prepare(`INSERT OR IGNORE INTO bio_salts (day, salt) VALUES (?, ?)`).bind(day, salt).run();
      await env.DB.prepare(`DELETE FROM bio_salts WHERE day < ?`).bind(melbourneDay(new Date(Date.now() - 3 * 86400_000))).run();
      row = await env.DB.prepare(`SELECT salt FROM bio_salts WHERE day = ?`).bind(day).first<{ salt: string }>();
    }
    const ip = request.headers.get("CF-Connecting-IP") ?? "";
    const ua = request.headers.get("User-Agent") ?? "";
    const data = new TextEncoder().encode(`${row!.salt}|${ip}|${ua}`);
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    return [...hash.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

async function log(env: Env, request: Request, kind: "view" | "click", target: string | null, src: string | null, campaign: string | null) {
  const now = new Date();
  const day = melbourneDay(now);
  const source = detectSource({ src, userAgent: request.headers.get("User-Agent"), referrer: request.headers.get("Referer") });
  const visitor = await visitorId(env, request, day);
  const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? null;
  await env.DB.prepare(`INSERT INTO bio_events (ts, day, kind, target, source, campaign, visitor, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(now.toISOString(), day, kind, target, source, campaign, visitor, country)
    .run();
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const bot = isBot(request.headers.get("User-Agent"));
    const src = url.searchParams.get("src") || url.searchParams.get("utm_source");
    const campaign = cleanCampaign(url.searchParams.get("c") || url.searchParams.get("utm_campaign"));

    // Outbound click: /go/<label>
    const go = url.pathname.match(/^\/go\/([a-z0-9-]+)\/?$/);
    if (go || /^\/waitlist\/?$/.test(url.pathname)) {
      const label = go ? go[1] : "waitlist";
      let dest = LINKS[label];
      if (!dest) return Response.redirect(url.origin + "/", 302);
      if (!go) dest = "https://shop.itsjustinjapan.com/waitlist?src=link"; // the short link people type
      if (!bot && request.method === "GET") ctx.waitUntil(log(env, request, "click", go ? label : "waitlist-link", src, campaign).catch(() => {}));
      return new Response(null, { status: 302, headers: { Location: dest, "Cache-Control": "no-store" } });
    }

    const res = await env.ASSETS.fetch(request);
    const isPage = request.method === "GET" && (res.headers.get("Content-Type") ?? "").includes("text/html");
    if (!isPage) return res;
    if (!bot) ctx.waitUntil(log(env, request, "view", url.pathname === "/" || url.pathname === "/index.html" ? null : url.pathname, src, campaign).catch(() => {}));

    // Point known outbound links at /go/<label>, carrying ?src= / ?c= so clicks keep their source.
    const carry = new URLSearchParams();
    if (src) carry.set("src", src);
    if (campaign) carry.set("c", campaign);
    const qs = carry.toString() ? `?${carry}` : "";
    const out = new HTMLRewriter()
      .on("a[href]", {
        element(el) {
          const label = LABEL_BY_URL.get(el.getAttribute("href") ?? "");
          if (label) el.setAttribute("href", `/go/${label}${qs}`);
        },
      })
      .transform(res);
    const headers = new Headers(out.headers);
    headers.set("Cache-Control", "no-store"); // every view reaches the Worker (and gets counted)
    return new Response(out.body, { status: out.status, headers });
  },
};
