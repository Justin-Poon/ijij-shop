import { test } from "node:test";
import assert from "node:assert/strict";
import { isAdmin } from "../src/util.ts";

const req = (v: string) => new Request("https://x/", { headers: { Authorization: v } });

test("admin password: exact, stray spaces/newlines and any characters all work", () => {
  assert.ok(isAdmin(req("Bearer hunter2"), { ADMIN_TOKEN: "hunter2" }));
  assert.ok(isAdmin(req("Bearer hunter2"), { ADMIN_TOKEN: "hunter2\n" }));
  assert.ok(isAdmin(req("Bearer hunter2"), { ADMIN_TOKEN: "  hunter2 " }));
  assert.ok(isAdmin(req("Bearer " + encodeURIComponent("pässwörd 東京!")), { ADMIN_TOKEN: "pässwörd 東京!" }));
  assert.ok(isAdmin(req("Bearer " + encodeURIComponent("50%off")), { ADMIN_TOKEN: "50%off" }));
});

test("admin password: wrong or missing is refused", () => {
  assert.ok(!isAdmin(req("Bearer nope"), { ADMIN_TOKEN: "hunter2" }));
  assert.ok(!isAdmin(req(""), { ADMIN_TOKEN: "hunter2" }));
  assert.ok(!isAdmin(req("Bearer "), { ADMIN_TOKEN: "" }));
  assert.ok(!isAdmin(req("Bearer hunter2"), {}));
});
