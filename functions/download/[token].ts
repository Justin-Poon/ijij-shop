// GET /download/:token  -> streams the guide PDF from R2 if the link is still valid.

import type { Env } from "../../src/env.ts";

interface TokenRow {
  token: string;
  file_key: string;
  expires_at: string;
  downloads: number;
  max_downloads: number;
}

function page(status: number, title: string, body: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="/styles.css"><main class="wrap narrow"><h1>${title}</h1><p>${body}</p><p><a href="/">Back to the shop</a></p></main>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const onRequestGet: PagesFunction<Env, "token"> = async ({ params, env }) => {
  const token = String(params.token);
  if (!/^[a-f0-9]{48}$/.test(token)) return page(404, "Link not found", "Check the link in your email.");

  const row = await env.DB.prepare(`SELECT * FROM download_tokens WHERE token = ?`).bind(token).first<TokenRow>();
  if (!row) return page(404, "Link not found", "Check the link in your email.");

  const help = "Reply to your order email and I'll send you a fresh link.";
  if (new Date(row.expires_at).getTime() < Date.now()) return page(410, "This link has expired", help);
  if (row.downloads >= row.max_downloads) return page(410, "Download limit reached", help);

  const obj = await env.FILES.get(row.file_key);
  if (!obj) {
    console.error(`missing R2 object ${row.file_key}`);
    return page(503, "Download unavailable", "Sorry, the file is temporarily unavailable. Please try again shortly.");
  }

  await env.DB.prepare(`UPDATE download_tokens SET downloads = downloads + 1 WHERE token = ?`).bind(token).run();

  return new Response(obj.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Japan - the complete guide.pdf"`,
      "Cache-Control": "private, no-store",
      ...(obj.size ? { "Content-Length": String(obj.size) } : {}),
    },
  });
};
