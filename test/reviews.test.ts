import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReview } from "../src/reviews.ts";

const good = { name: "  Sarah  K. ", email: " Sarah@Example.com ", stars: 5, text: "Loved it.\r\n\r\n\r\nThe food pages were great!", consent: true };

test("a good review is tidied up", () => {
  const r = validateReview(good);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.value.name, "Sarah K.");
  assert.equal(r.value.email, "sarah@example.com");
  assert.equal(r.value.text, "Loved it.\n\nThe food pages were great!");
  assert.equal(r.value.consent, true);
});

test("consent only counts when it's exactly true", () => {
  const r = validateReview({ ...good, consent: "yes" });
  assert.ok(r.ok && r.value.consent === false);
});

test("bad input is rejected with a friendly message", () => {
  for (const bad of [
    { ...good, name: "" },
    { ...good, name: "x".repeat(41) },
    { ...good, email: "nope" },
    { ...good, stars: 0 },
    { ...good, stars: 6 },
    { ...good, stars: 4.5 },
    { ...good, text: "short" },
    { ...good, text: "x".repeat(1501) },
    null,
  ]) {
    const r = validateReview(bad);
    assert.equal(r.ok, false, JSON.stringify(bad));
    if (!r.ok) assert.ok(r.error.length > 5);
  }
});

test("control characters are stripped from the name", () => {
  const r = validateReview({ ...good, name: "Eve\u0000\u0007lyn" });
  assert.ok(r.ok && r.value.name === "Eve lyn");
});
