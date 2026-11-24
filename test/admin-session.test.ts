import { test } from "node:test";
import assert from "node:assert/strict";
import { makeAdminCookie, hasAdminCookie, withAdminCookie } from "../src/admin-session.ts";

const reqWith = (cookie: string) => new Request("https://x/api/admin/stats", { headers: { Cookie: cookie } });
const value = (setCookie: string) => setCookie.split(";")[0];

test("admin cookie: valid for 90 days, signed with the password", async () => {
  const c = value(await makeAdminCookie("hunter2", true));
  assert.ok(await hasAdminCookie(reqWith(c), "hunter2"));
  assert.ok(!(await hasAdminCookie(reqWith(c), "other-password")));
  assert.ok(!(await hasAdminCookie(reqWith(c), "hunter2", Date.now() + 91 * 86400_000)));
  assert.ok(!(await hasAdminCookie(reqWith("ijij_admin=9999999999999.abc"), "hunter2")));
});

test("admin cookie: lets requests through as if they sent the password", async () => {
  const c = value(await makeAdminCookie("hunter2", true));
  const r = await withAdminCookie(reqWith(c), { ADMIN_TOKEN: "hunter2" });
  assert.equal(r.headers.get("Authorization"), "Bearer hunter2");
  const none = await withAdminCookie(reqWith("other=1"), { ADMIN_TOKEN: "hunter2" });
  assert.equal(none.headers.get("Authorization"), null);
});
