// GET /api/reviews
// Approved reviews the customer agreed to share, newest first. Emails are never returned.

import type { Env } from "../../src/env.ts";
import { json } from "../../src/util.ts";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const rows = await env.DB.prepare(
    `SELECT name, stars, text, verified, created_at FROM reviews
      WHERE status = 'approved' AND consent = 1 ORDER BY created_at DESC LIMIT 50`,
  ).all<{ name: string; stars: number; text: string; verified: number; created_at: string }>();

  const reviews = rows.results.map((r) => ({
    name: r.name,
    stars: r.stars,
    text: r.text,
    verified: r.verified === 1,
    date: r.created_at.slice(0, 10),
  }));
  return json(reviews, 200, { "Cache-Control": "public, max-age=300" });
};
