// Delivery email, sent through Resend (resend.com). Swap this file to change provider.

import type { Env } from "./env.ts";
import type { Delivery } from "./fulfil.ts";
import { escapeHtml } from "./util.ts";

export function deliveryEmail(env: Env, d: Delivery) {
  const first = d.order.name?.split(" ")[0];
  const hello = first ? `Hi ${first},` : "Hi,";
  const days = env.DOWNLOAD_DAYS || "60";

  const text = [
    hello,
    "",
    "Thanks so much for buying the guide! Here's everything:",
    "",
    `Japan: the complete guide (PDF): ${d.downloadUrl}`,
    ...d.planners.map((p) => `${p.label}: ${p.url}`),
    "",
    `The download link works for ${days} days, so save the PDF somewhere you'll find it in Japan.`,
    "The planner links open a copy of the Canva template in your own Canva account to edit.",
    "",
    "Any problems, just reply to this email.",
    "",
    "Justin",
    "@itsjustinjapan",
  ].join("\n");

  const link = (href: string, label: string) =>
    `<p style="margin:0 0 12px"><a href="${escapeHtml(href)}" style="display:inline-block;background:#7a1f2b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>`;

  const html = `<!doctype html><html><body style="margin:0;background:#faf6f2;font-family:Inter,Arial,sans-serif;color:#2a2224">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-size:16px">${escapeHtml(hello)}</p>
<p style="font-size:16px;line-height:1.5">Thanks so much for buying the guide! Here's everything:</p>
${link(d.downloadUrl, "Download the guide (PDF)")}
${d.planners.map((p) => link(p.url, `Open the ${p.label.replace(" (Canva template)", "")}`)).join("\n")}
<p style="font-size:14px;line-height:1.5;color:#6b5d60">The download link works for ${escapeHtml(days)} days, so save the PDF somewhere you'll find it in Japan. The planner links open a copy of the Canva template in your own Canva account to edit.</p>
<p style="font-size:14px;line-height:1.5;color:#6b5d60">Any problems, just reply to this email.</p>
<p style="font-size:16px">Justin<br><span style="color:#6b5d60">@itsjustinjapan</span></p>
</div></body></html>`;

  return { subject: "Your Japan guide and planner", text, html };
}

export async function sendDeliveryEmail(env: Env, d: Delivery): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email skipped: no RESEND_API_KEY] to=${d.order.email} link=${d.downloadUrl}`);
    return;
  }
  const { subject, text, html } = deliveryEmail(env, d);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [d.order.email], subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}
