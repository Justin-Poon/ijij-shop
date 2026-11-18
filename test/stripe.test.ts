import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeForm, signPayload, verifyWebhook } from "../src/stripe.ts";

test("encodeForm handles nested arrays and objects like Stripe expects", () => {
  const out = decodeURIComponent(
    encodeForm({
      mode: "payment",
      line_items: [{ price: "price_a", quantity: 1 }, { price: "price_b", quantity: 1 }],
      metadata: { upgrade: "21" },
      expand: ["line_items"],
      skip: undefined,
    }),
  );
  assert.equal(
    out,
    "mode=payment&line_items[0][price]=price_a&line_items[0][quantity]=1&line_items[1][price]=price_b&line_items[1][quantity]=1&metadata[upgrade]=21&expand[0]=line_items",
  );
});

test("verifyWebhook accepts a correctly signed payload", async () => {
  const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_1" } } });
  const header = await signPayload("whsec_test", body, 1000);
  const event = await verifyWebhook<any>(body, header, "whsec_test", 300, 1100);
  assert.equal(event.data.object.id, "cs_1");
});

test("verifyWebhook rejects a wrong secret", async () => {
  const body = "{}";
  const header = await signPayload("whsec_other", body, 1000);
  await assert.rejects(verifyWebhook(body, header, "whsec_test", 300, 1000), /mismatch/);
});

test("verifyWebhook rejects a tampered body", async () => {
  const header = await signPayload("whsec_test", '{"a":1}', 1000);
  await assert.rejects(verifyWebhook('{"a":2}', header, "whsec_test", 300, 1000), /mismatch/);
});

test("verifyWebhook rejects old timestamps (replay)", async () => {
  const header = await signPayload("whsec_test", "{}", 1000);
  await assert.rejects(verifyWebhook("{}", header, "whsec_test", 300, 2000), /tolerance/);
});

test("verifyWebhook rejects a missing header", async () => {
  await assert.rejects(verifyWebhook("{}", null, "whsec_test"), /Missing/);
});
