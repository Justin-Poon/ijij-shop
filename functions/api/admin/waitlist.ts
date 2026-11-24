// GET /api/admin/waitlist[?format=csv]   Authorization: Bearer <ADMIN_TOKEN>
// The launch waitlist: counts and the list (CSV for importing into Resend or another email tool).

import type { Env } from "../../../src/env.ts";
import { isAdmin, json } from "../../../src/util.ts";

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : s;
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = request.headers.get("Authorization") ?? "";
  if (!isAdmin(request, env)) return json({ error: "unauthorised" }, 401);
  const rows = (await env.DB.prepare(
    `SELECT created_at, email, name, travel_month, source FROM waitlist WHERE unsubscribed_at IS NULL ORDER BY created_at DESC`,
  ).all()).results as Record<string, unknown>[];
  if (new URL(request.url).searchParams.get("format") === "csv") {
    const head = ["email", "first_name", "travel_month", "source", "signed_up"];
    const lines = rows.map((r) => [r.email, r.name, r.travel_month, r.source, r.created_at].map(csvCell).join(","));
    return new Response([head.join(","), ...lines].join("\n") + "\n", {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="waitlist.csv"`, "Cache-Control": "no-store" },
    });
  }
  const week = new Date(Date.now() - 7 * 86400_000).toISOString();
  return json({ total: rows.length, last7days: rows.filter((r) => String(r.created_at) >= week).length, recent: rows.slice(0, 50) });
};
