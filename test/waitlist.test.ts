import { test } from "node:test";
import assert from "node:assert/strict";
import { validateWaitlist } from "../src/waitlist.ts";

test("waitlist: needs a valid email and consent", () => {
  assert.equal(validateWaitlist({ email: "a@b.co", consent: true }).ok, true);
  assert.equal(validateWaitlist({ email: "nope", consent: true }).ok, false);
  assert.equal(validateWaitlist({ email: "a@b.co" }).ok, false);
});
test("waitlist: tidies optional fields", () => {
  const v = validateWaitlist({ email: " A@B.co ", name: "  Sam  ", travel_month: "2027-04", source: "ig<script>", consent: true });
  assert.ok(v.ok);
  if (v.ok) assert.deepEqual(v.value, { email: "a@b.co", name: "Sam", travel_month: "2027-04", source: "igscript" });
  assert.equal(validateWaitlist({ email: "a@b.co", travel_month: "April", consent: true }).ok, false);
});
