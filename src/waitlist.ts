// Waitlist sign-ups: validation for the public form.

export interface WaitlistInput {
  email: string;
  name: string | null;
  travel_month: string | null;
  source: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateWaitlist(body: unknown): { ok: true; value: WaitlistInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const name = typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim().slice(0, 40) : "";
  const month = typeof b.travel_month === "string" ? b.travel_month.trim() : "";
  const source = typeof b.source === "string" ? b.source.replace(/[^\w-]/g, "").slice(0, 40) : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (month && !/^20\d\d-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, error: "Please pick a travel month, or leave it blank." };
  if (b.consent !== true) return { ok: false, error: "Please tick the box so I can email you when it's ready." };
  return { ok: true, value: { email, name: name || null, travel_month: month || null, source: source || null } };
}
