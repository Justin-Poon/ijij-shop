// Customer reviews: validation for the public form and the shape shown on the shop page.

export interface ReviewInput {
  name: string;
  email: string;
  stars: number;
  text: string;
  consent: boolean;
}

export const REVIEW_LIMITS = { name: 40, text: 1500, minText: 10 } as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Collapse whitespace and strip control characters, keeping line breaks in the review text. */
function tidy(s: string, keepNewlines = false): string {
  const noCtrl = s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, keepNewlines ? "" : " ");
  return keepNewlines
    ? noCtrl.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    : noCtrl.replace(/\s+/g, " ").trim();
}

export function validateReview(body: unknown): { ok: true; value: ReviewInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? tidy(b.name) : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const text = typeof b.text === "string" ? tidy(b.text, true) : "";
  const stars = Number(b.stars);

  if (!name) return { ok: false, error: "Please add your name." };
  if (name.length > REVIEW_LIMITS.name) return { ok: false, error: `Please keep your name under ${REVIEW_LIMITS.name} characters.` };
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, error: "Please enter the email you ordered with." };
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, error: "Please choose a star rating." };
  if (text.length < REVIEW_LIMITS.minText) return { ok: false, error: "Please write a few words about your trip." };
  if (text.length > REVIEW_LIMITS.text) return { ok: false, error: `Please keep your review under ${REVIEW_LIMITS.text} characters.` };

  return { ok: true, value: { name, email, stars, text, consent: b.consent === true } };
}
