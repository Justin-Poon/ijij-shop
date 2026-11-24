// GET  /api/admin/bio?days=30   Authorization: Bearer <ADMIN_TOKEN>
//   Bio link (itsjustinjapan.com) traffic: visitors, clicks per link, daily chart, and the traffic each post drove.
// POST /api/admin/bio  { action: "add", day, title, platform?, views? } | { action: "views", id, views } | { action: "delete", id }
//   Posts marked as posted in IJIJ Studio are written to bio_posts by the studio itself (studio_id set).
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

  const today = melbourneDay(new Date());
  const prevSince = addDays(since, -days), prevUntil = addDays(since, -1);
  const [tot] = await q<{ visitors: number; views: number }>(`SELECT ${uniq} AS visitors, COUNT(*) AS views FROM bio_events WHERE kind='view' AND day >= ?`, since);
  // The same-length period just before, for the ▲/▼ comparison on the tiles.
  const [prev] = await q<{ visitors: number; etsy: number }>(
    `SELECT COUNT(DISTINCT CASE WHEN kind='view' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS visitors,
            COUNT(DISTINCT CASE WHEN kind='click' AND target LIKE 'etsy%' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS etsy
       FROM bio_events WHERE day >= ? AND day <= ?`, prevSince, prevUntil);
  const [first] = await q<{ day: string | null }>(`SELECT MIN(day) AS day FROM bio_events`);
  const firstDay = first?.day ?? today;
  const links = await q<{ target: string; clicks: number; people: number }>(
    `SELECT target, COUNT(*) AS clicks, ${uniq} AS people FROM bio_events WHERE kind='click' AND day >= ? GROUP BY target ORDER BY people DESC`, since);
  const dailyRows = await q<{ day: string; visitors: number; etsy: number; clickers: number }>(
    `SELECT day,
            COUNT(DISTINCT CASE WHEN kind='view' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS visitors,
            COUNT(DISTINCT CASE WHEN kind='click' AND target LIKE 'etsy%' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS etsy,
            COUNT(DISTINCT CASE WHEN kind='click' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS clickers
       FROM bio_events WHERE day >= ? GROUP BY day ORDER BY day`, since);
  // One bar per day from when tracking started (or the range start), zeros included, so gaps show as gaps.
  const byDay = new Map(dailyRows.map((d) => [d.day, d]));
  const daily = [];
  for (let d = since < firstDay ? firstDay : since; d <= today; d = addDays(d, 1)) daily.push(byDay.get(d) ?? { day: d, visitors: 0, etsy: 0, clickers: 0 });
  const sources = await q<{ source: string; visitors: number }>(
    `SELECT source, ${uniq} AS visitors FROM bio_events WHERE kind='view' AND day >= ? GROUP BY source ORDER BY visitors DESC`, since);
  const campaigns = await q<{ campaign: string; visitors: number; etsy: number }>(
    `SELECT campaign,
            COUNT(DISTINCT CASE WHEN kind='view' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS visitors,
            COUNT(DISTINCT CASE WHEN kind='click' AND target LIKE 'etsy%' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS etsy
       FROM bio_events WHERE campaign IS NOT NULL AND day >= ? GROUP BY campaign ORDER BY visitors DESC`, since);
  const countries = await q<{ country: string; visitors: number }>(
    `SELECT COALESCE(country,'?') AS country, ${uniq} AS visitors FROM bio_events WHERE kind='view' AND day >= ? GROUP BY country ORDER BY visitors DESC LIMIT 8`, since);

  // Each post: visitors and Etsy clickers on the day it went out + the 2 days after, against the days before
  // (up to 7). "Usual" needs at least 3 days of tracking before the post, otherwise it isn't shown.
  const posts = await q<{ id: number; day: string; title: string; platform: string | null; views: number | null; studio_id: number | null }>(
    `SELECT id, day, title, platform, views, studio_id FROM bio_posts ORDER BY day DESC, id DESC LIMIT 50`);
  const window = async (from: string, to: string) =>
    (await q<{ visitors: number; etsy: number }>(
      `SELECT COUNT(DISTINCT CASE WHEN kind='view' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS visitors,
              COUNT(DISTINCT CASE WHEN kind='click' AND target LIKE 'etsy%' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS etsy
         FROM bio_events WHERE day >= ? AND day <= ?`, from, to))[0];
  const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400_000);
  const postStats = [];
  for (const p of posts) {
    const end = addDays(p.day, 2) < today ? addDays(p.day, 2) : today;
    const after = await window(p.day, end);
    const span = daysBetween(p.day, end) + 1; // 1–3 days so far
    const start = addDays(p.day, -7) < firstDay ? firstDay : addDays(p.day, -7);
    const history = Math.max(0, daysBetween(start, p.day));
    let baseline: number | null = null, extra: number | null = null;
    if (history >= 3) {
      const before = await window(start, addDays(p.day, -1));
      baseline = Math.round((before.visitors / history) * span);
      extra = Math.max(0, after.visitors - baseline);
    }
    postStats.push({ ...p, visitors: after.visitors, etsy: after.etsy, days: span, baseline, extra,
      etsyPer1k: p.views ? Math.round((after.etsy / p.views) * 10000) / 10 : null });
  }

  const etsy = links.filter((l) => l.target.startsWith("etsy")).reduce((n, l) => n + l.people, 0);
  return json({
    total: { visitors: tot.visitors, views: tot.views, etsyClickers: etsy, etsyRate: tot.visitors ? etsy / tot.visitors : null },
    previous: { visitors: prev.visitors, etsyClickers: prev.etsy, hasData: prevUntil >= firstDay },
    trackingSince: firstDay,
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
  if (b?.action === "views" && Number.isInteger(b.id)) {
    const views = Number.isFinite(Number(b.views)) && Number(b.views) > 0 ? Math.round(Number(b.views)) : null;
    await env.DB.prepare(`UPDATE bio_posts SET views = ? WHERE id = ?`).bind(views, b.id).run();
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
