export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export function randomToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function formatMoney(amount: number, currency: string): string {
  // en-US shows USD as plain "$" (and other dollars as e.g. "A$"). Whole amounts drop the ".00".
  const whole = amount % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

/** Admin check for /api/admin/*: the admin page sends the password URI-encoded (so any character works);
 *  both sides are trimmed so a stray space or line break in the saved secret doesn't lock you out. */
export function isAdmin(request: Request, env: { ADMIN_TOKEN?: string }): boolean {
  const secret = (env.ADMIN_TOKEN ?? "").trim();
  if (!secret) return false;
  const raw = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let given = raw;
  try { given = decodeURIComponent(raw); } catch {}
  given = given.trim();
  if (given.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= secret.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
