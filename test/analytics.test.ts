import { test } from "node:test";
import assert from "node:assert/strict";
import { detectSource, isBot, melbourneDay, normaliseSource } from "../src/analytics.ts";

const TIKTOK_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_36.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en";
const IG_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 Instagram 350.0.0.0.0 (iPhone15,2; iOS 18_0; en_AU)";
const SAFARI_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

test("explicit ?src= wins and is normalised", () => {
  assert.equal(detectSource({ src: "IG", userAgent: TIKTOK_UA }), "instagram");
  assert.equal(detectSource({ src: "tt" }), "tiktok");
  assert.equal(detectSource({ src: "newsletter" }), "email");
});

test("in-app browsers are recognised", () => {
  assert.equal(detectSource({ userAgent: TIKTOK_UA }), "tiktok");
  assert.equal(detectSource({ userAgent: IG_UA }), "instagram");
});

test("referrers are recognised", () => {
  assert.equal(detectSource({ userAgent: SAFARI_UA, referrer: "https://l.instagram.com/?u=x" }), "instagram");
  assert.equal(detectSource({ userAgent: SAFARI_UA, referrer: "https://www.tiktok.com/@itsjustinjapan" }), "tiktok");
  assert.equal(detectSource({ userAgent: SAFARI_UA, referrer: "https://www.google.com/" }), "search");
  assert.equal(detectSource({ userAgent: SAFARI_UA, referrer: "https://linktr.ee/x" }), "other:linktr.ee");
  assert.equal(detectSource({ userAgent: SAFARI_UA }), "direct");
});

test("junk source labels are dropped", () => {
  assert.equal(normaliseSource("<script>"), null);
  assert.equal(normaliseSource(""), null);
  assert.equal(normaliseSource("  Instagram "), "instagram");
});

test("bots are skipped", () => {
  assert.equal(isBot("facebookexternalhit/1.1"), true);
  assert.equal(isBot("Googlebot/2.1"), true);
  assert.equal(isBot(null), true);
  assert.equal(isBot(IG_UA), false);
});

test("days are counted in Melbourne time", () => {
  // 20:00 UTC on 18 Nov is 07:00 on 19 Nov in Melbourne (AEDT, UTC+11)
  assert.equal(melbourneDay(new Date("2026-11-18T20:00:00Z")), "2026-11-19");
});
