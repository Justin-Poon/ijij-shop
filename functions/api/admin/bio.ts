// GET  /api/admin/bio?days=30   Authorization: Bearer <ADMIN_TOKEN>
//   Bio link (itsjustinjapan.com) traffic: visitors, clicks per link, daily chart, and the traffic each post drove.
// POST /api/admin/bio  { action: "add", day, title, platform?, views? } | { action: "delete", id }
//   Record when a post went out, so its effect shows up on the dashboard.

import type { Env } from "../../../src/env.ts";
import { melbourneDay } from "../../../src/analytics.ts";
import { isAdmin, json } from "../../../src/util.ts";

const authed = (request: Request, env: Env) => isAdmin(request, env);
const uniq = `COUNT(DISTINCT COALESCE(visitor, CAST(id AS TEXT)))`;
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!authed(request, env)) return json({ error: "unauthorised" }, 401);
  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 30, 1), 365);
  const since = melbourneDay(new Date(Date.now() - (days - 1) * 86400_000));
  const q = <T>(sql: string, ...b: unknown[]) => env.DB.prepare(sql).bind(...b).all<T>().then((r) => r.results);

  const [tot] = await q<{ visitors: number; views: number }>(`SELECT ${uniq} AS visitors, COUNT(*) AS views FROM bio_events WHERE kind='view' AND day >= ?`, since);
  const links = await q<{ target: string; clicks: number; people: number }>(
    `SELECT target, COUNT(*) AS clicks, ${uniq} AS people FROM bio_events WHERE kind='click' AND day >= ? GROUP BY target ORDER BY people DESC`, since);
  const daily = await q<{ day: string; visitors: number; etsy: number; clickers: number }>(
    `SELECT day,
            COUNT(DISTINCT CASE WHEN kind='view' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS visitors,
            COUNT(DISTINCT CASE WHEN kind='click' AND target LIKE 'etsy%' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS etsy,
            COUNT(DISTINCT CASE WHEN kind='click' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS clickers
       FROM bio_events WHERE day >= ? GROUP BY day ORDER BY day`, since);
  const sources = await q<{ source: string; visitors: number }>(
    `SELECT source, ${uniq} AS visitors FROM bio_events WHERE kind='view' AND day >= ? GROUP BY source ORDER BY visitors DESC`, since);
  const campaigns = await q<{ campaign: string; visitors: number; etsy: number }>(
    `SELECT campaign,
            COUNT(DISTINCT CASE WHEN kind='view' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS visitors,
            COUNT(DISTINCT CASE WHEN kind='click' AND target LIKE 'etsy%' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS etsy
       FROM bio_events WHERE campaign IS NOT NULL AND day >= ? GROUP BY campaign ORDER BY visitors DESC`, since);
  const countries = await q<{ country: string; visitors: number }>(
    `SELECT COALESCE(country,'?') AS country, ${uniq} AS visitors FROM bio_events WHERE kind='view' AND day >= ? GROUP BY country ORDER BY visitors DESC LIMIT 8`, since);

  // Each post: visitors and Etsy clickers on the day it went out + the 2 days after, against the 7 days before.
  const posts = await q<{ id: number; day: string; title: string; platform: string | null; views: number | null }>(
    `SELECT id, day, title, platform, views FROM bio_posts ORDER BY day DESC LIMIT 50`);
  const window = async (from: string, to: string) =>
    (await q<{ visitors: number; etsy: number }>(
      `SELECT COUNT(DISTINCT CASE WHEN kind='view' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS visitors,
              COUNT(DISTINCT CASE WHEN kind='click' AND target LIKE 'etsy%' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS etsy
         FROM bio_events WHERE day >= ? AND day <= ?`, from, to))[0];
  const postStats = [];
  for (const p of posts) {
    const after = await window(p.day, addDays(p.day, 2));
    const before = await window(addDays(p.day, -7), addDays(p.day, -1));
    const baseline = (before.visitors / 7) * 3;
    postStats.push({ ...p, visitors: after.visitors, etsy: after.etsy, baseline: Math.round(baseline), extra: Math.max(0, Math.round(after.visitors - baseline)) });
  }

  const etsy = links.filter((l) => l.target.startsWith("etsy")).reduce((n, l) => n + l.people, 0);
  return json({
    total: { visitors: tot.visitors, views: tot.views, etsyClickers: etsy, etsyRate: tot.visitors ? etsy / tot.visitors : null },
    links, daily, sources, campaigns, countries, posts: postStats,
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!authed(request, env)) return json({ error: "unauthorised" }, 401);
  const b = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (b?.action === "delete" && Number.isInteger(b.id)) {
    await env.DB.prepare(`DELETE FROM bio_posts WHERE id = ?`).bind(b.id).run();
    return json({ ok: true });
  }
  if (b?.action === "add") {
    const day = String(b.day ?? "");
    const title = String(b.title ?? "").trim().slice(0, 120);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !title) return json({ error: "Give a date and a title." }, 400);
    const platform = b.platform === "tiktok" ? "tiktok" : "instagram";
    const views = Number.isFinite(Number(b.views)) && Number(b.views) > 0 ? Math.round(Number(b.views)) : null;
    const r = await env.DB.prepare(`INSERT INTO bio_posts (day, title, platform, views, created_at) VALUES (?, ?, ?, ?, ?)`)
      .bind(day, title, platform, views, new Date().toISOString()).run();
    return json({ id: r.meta.last_row_id }, 201);
  }
  return json({ error: "Unknown action." }, 400);
};
