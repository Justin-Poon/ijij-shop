// POST /api/track {source, visitor, campaign}
// Records a product-page view, attributed to where the visitor came from.

import type { Env } from "../../src/env.ts";
import { allowed, cleanCampaign, cleanVariant, cleanVisitor, detectSource, isBot, normaliseSource, recordEvent } from "../../src/analytics.ts";
import { json } from "../../src/util.ts";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ua = request.headers.get("User-Agent");
  if (isBot(ua)) return new Response(null, { status: 204 });
  if (!(await allowed(env.TRACK_LIMITER, request, "track"))) return new Response(null, { status: 204 });

  const b = (await request.json().catch(() => ({}))) as { source?: string; visitor?: string; campaign?: string; referrer?: string; variant?: string };
  const source = normaliseSource(b.source) ?? detectSource({ userAgent: ua, referrer: b.referrer ?? request.headers.get("Referer") });
  try {
    await recordEvent(env, { event: "view", source, visitor: cleanVisitor(b.visitor), campaign: cleanCampaign(b.campaign), variant: cleanVariant(b.variant) });
  } catch (err) {
    console.error("track failed", err);
  }
  return json({ ok: true, source });
};
