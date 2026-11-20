// GET /api/admin/stats?days=30   Authorization: Bearer <ADMIN_TOKEN>
// Funnel by traffic source: unique visitors, checkouts started, purchases, conversion and revenue.

import type { Env } from "../../../src/env.ts";
import { melbourneDay } from "../../../src/analytics.ts";
import { json } from "../../../src/util.ts";

interface Row {
  source: string;
  visitors: number;
  views: number;
  checkouts: number;
  orders: number;
  revenue: number;
  upgrades: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = request.headers.get("Authorization") ?? "";
  if (!env.ADMIN_TOKEN || auth !== `Bearer ${env.ADMIN_TOKEN}`) return json({ error: "unauthorised" }, 401);

  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 30, 1), 365);
  const since = new Date(Date.now() - (days - 1) * 86400_000);
  const sinceDay = melbourneDay(since);
  const sinceIso = new Date(`${sinceDay}T00:00:00+11:00`).toISOString(); // close enough for a daily dashboard

  const ev = await env.DB.prepare(
    `SELECT source,
            COUNT(DISTINCT CASE WHEN event='view' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS visitors,
            SUM(event='view') AS views,
            COUNT(DISTINCT CASE WHEN event='checkout' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS checkouts
       FROM events WHERE day >= ? GROUP BY source`,
  )
    .bind(sinceDay)
    .all<{ source: string; visitors: number; views: number; checkouts: number }>();

  const ord = await env.DB.prepare(
    `SELECT COALESCE(source,'unknown') AS source, COUNT(*) AS orders, SUM(amount_total) AS revenue, SUM(has_21) AS upgrades
       FROM orders WHERE refunded_at IS NULL AND created_at >= ? GROUP BY COALESCE(source,'unknown')`,
  )
    .bind(sinceIso)
    .all<{ source: string; orders: number; revenue: number; upgrades: number }>();

  const daily = await env.DB.prepare(
    `SELECT day, COUNT(DISTINCT CASE WHEN event='view' THEN COALESCE(visitor, CAST(id AS TEXT)) END) AS visitors
       FROM events WHERE day >= ? GROUP BY day ORDER BY day`,
  )
    .bind(sinceDay)
    .all<{ day: string; visitors: number }>();

  const by = new Map<string, Row>();
  const get = (s: string) => {
    if (!by.has(s)) by.set(s, { source: s, visitors: 0, views: 0, checkouts: 0, orders: 0, revenue: 0, upgrades: 0 });
    return by.get(s)!;
  };
  for (const r of ev.results) Object.assign(get(r.source), { visitors: r.visitors, views: r.views, checkouts: r.checkouts });
  for (const r of ord.results) Object.assign(get(r.source), { orders: r.orders, revenue: r.revenue ?? 0, upgrades: r.upgrades ?? 0 });

  const rows = [...by.values()].sort((a, b) => b.revenue - a.revenue || b.visitors - a.visitors);
  const total = rows.reduce(
    (t, r) => ({ ...t, visitors: t.visitors + r.visitors, views: t.views + r.views, checkouts: t.checkouts + r.checkouts, orders: t.orders + r.orders, revenue: t.revenue + r.revenue, upgrades: t.upgrades + r.upgrades }),
    { source: "total", visitors: 0, views: 0, checkouts: 0, orders: 0, revenue: 0, upgrades: 0 },
  );
  const rate = (r: Row) => ({ ...r, conversion: r.visitors ? r.orders / r.visitors : null, upgradeRate: r.orders ? r.upgrades / r.orders : null });

  return json({ days, since: sinceDay, currency: "aud", sources: rows.map(rate), total: rate(total), daily: daily.results });
};
