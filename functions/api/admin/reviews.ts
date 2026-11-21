// GET  /api/admin/reviews?status=pending|approved|hidden|all   Authorization: Bearer <ADMIN_TOKEN>
// POST /api/admin/reviews {id, status: 'approved'|'hidden'|'pending'}
// Lets the owner approve or hide reviews. Only approved reviews with the customer's consent go on the shop.

import type { Env } from "../../../src/env.ts";
import { json } from "../../../src/util.ts";

const STATUSES = new Set(["pending", "approved", "hidden"]);

function authorised(request: Request, env: Env): boolean {
  const auth = request.headers.get("Authorization") ?? "";
  return !!env.ADMIN_TOKEN && auth === `Bearer ${env.ADMIN_TOKEN}`;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!authorised(request, env)) return json({ error: "unauthorised" }, 401);
  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  const where = STATUSES.has(status) ? `WHERE status = ?` : ``;
  const stmt = env.DB.prepare(
    `SELECT id, created_at, name, stars, text, email, verified, consent, status FROM reviews ${where} ORDER BY created_at DESC LIMIT 200`,
  );
  const rows = await (STATUSES.has(status) ? stmt.bind(status) : stmt).all();
  const counts = await env.DB.prepare(`SELECT status, COUNT(*) AS n FROM reviews GROUP BY status`).all<{ status: string; n: number }>();
  return json({ reviews: rows.results, counts: Object.fromEntries(counts.results.map((c) => [c.status, c.n])) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!authorised(request, env)) return json({ error: "unauthorised" }, 401);
  const b = (await request.json().catch(() => ({}))) as { id?: unknown; status?: unknown };
  const id = Number(b.id);
  if (!Number.isInteger(id) || id < 1 || typeof b.status !== "string" || !STATUSES.has(b.status)) return json({ error: "bad request" }, 400);
  const res = await env.DB.prepare(`UPDATE reviews SET status = ?, decided_at = ? WHERE id = ?`)
    .bind(b.status, new Date().toISOString(), id)
    .run();
  if (!res.meta.changes) return json({ error: "not found" }, 404);
  return json({ ok: true });
};
