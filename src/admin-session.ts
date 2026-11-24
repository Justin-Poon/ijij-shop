// Admin login cookie: log in once on /admin and stay logged in for 90 days on that device.
// The cookie holds an expiry time signed with ADMIN_TOKEN (HMAC-SHA256); changing ADMIN_TOKEN logs every device out.
import { isAdmin, json } from "./util.ts";

const COOKIE = "ijij_admin";
const DAYS = 90;
const enc = new TextEncoder();

async function sign(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function makeAdminCookie(secret: string, secure: boolean, now = Date.now()): Promise<string> {
  const exp = now + DAYS * 86400_000;
  return `${COOKIE}=${exp}.${await sign(secret, `admin:${exp}`)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DAYS * 86400}${secure ? "; Secure" : ""}`;
}

export async function hasAdminCookie(request: Request, secret: string, now = Date.now()): Promise<boolean> {
  if (!secret) return false;
  const m = (request.headers.get("Cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9]+)\\.([0-9a-f]{64})`));
  if (!m || Number(m[1]) < now) return false;
  const want = await sign(secret, `admin:${m[1]}`);
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ m[2].charCodeAt(i);
  return diff === 0;
}

/** Requests to /api/admin/* that carry a valid login cookie are passed on as if they sent the password,
 *  so every admin handler keeps its simple isAdmin() check. */
export async function withAdminCookie(request: Request, env: { ADMIN_TOKEN?: string }): Promise<Request> {
  const secret = (env.ADMIN_TOKEN ?? "").trim();
  if (request.headers.get("Authorization") || !(await hasAdminCookie(request, secret))) return request;
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${encodeURIComponent(secret)}`);
  return new Request(request, { headers });
}

export async function adminLogin({ request, env }: { request: Request; env: { ADMIN_TOKEN?: string } }): Promise<Response> {
  const b = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const pw = typeof b?.password === "string" ? b.password : "";
  const probe = new Request(request.url, { headers: { Authorization: `Bearer ${encodeURIComponent(pw)}` } });
  if (!isAdmin(probe, env)) return json({ error: "That password didn't work." }, 401);
  const cookie = await makeAdminCookie((env.ADMIN_TOKEN ?? "").trim(), new URL(request.url).protocol === "https:");
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
}

export function adminLogout(): Response {
  return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` });
}
