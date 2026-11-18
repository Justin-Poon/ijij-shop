// A tiny fake Stripe API for local end-to-end tests. Not used in production.
// Usage: node scripts/mock-stripe.mjs <port> <site_url>
import http from "node:http";

const port = Number(process.argv[2] || 12111);
const site = process.argv[3] || "http://localhost:8788";
const intents = new Map();
const promos = {
  JAPLAN10: { id: "promo_1", code: "JAPLAN10", active: true, expires_at: null, max_redemptions: null, times_redeemed: 0, coupon: { id: "c1", valid: true, percent_off: 10, amount_off: null, currency: null }, restrictions: { minimum_amount: null } },
  FREEBIE: { id: "promo_2", code: "FREEBIE", active: true, expires_at: null, max_redemptions: null, times_redeemed: 0, coupon: { id: "c2", valid: true, percent_off: 100, amount_off: null, currency: null }, restrictions: { minimum_amount: null } },
  OLDCODE: { id: "promo_3", code: "OLDCODE", active: true, expires_at: 1000, max_redemptions: null, times_redeemed: 0, coupon: { id: "c3", valid: true, percent_off: 20, amount_off: null, currency: null }, restrictions: { minimum_amount: null } },
};
const prices = {
  price_bundle: { id: "price_bundle", unit_amount: 3900, currency: "aud", active: true },
  price_upgrade: { id: "price_upgrade", unit_amount: 1000, currency: "aud", active: true },
};
let n = 0;

function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(new URLSearchParams(b)));
  });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const send = (status, data) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    // Test hook: pretend the buyer completed payment (or it failed).
    const hook = url.pathname.match(/^\/__(succeed|fail)\/(pi_[^/]+)$/);
    if (hook) {
      const pi = intents.get(hook[2]);
      if (!pi) return send(404, {});
      pi.status = hook[1] === "succeed" ? "succeeded" : "requires_payment_method";
      return send(200, pi);
    }
    if (req.headers.authorization !== "Bearer sk_test_mock") return send(401, { error: { message: "bad key" } });

    if (req.method === "POST" && url.pathname === "/v1/payment_intents") {
      const p = await readBody(req);
      const id = `pi_mock${++n}`;
      const metadata = {};
      for (const [k, v] of p) {
        const m = k.match(/^metadata\[(.+)\]$/);
        if (m) metadata[m[1]] = v;
      }
      const pi = {
        id,
        object: "payment_intent",
        amount: Number(p.get("amount")),
        currency: p.get("currency"),
        status: "requires_payment_method",
        client_secret: `${id}_secret_test`,
        receipt_email: p.get("receipt_email"),
        metadata,
      };
      intents.set(id, pi);
      return send(200, pi);
    }
    const m = url.pathname.match(/^\/v1\/payment_intents\/([^/]+)$/);
    if (req.method === "GET" && m) {
      const pi = intents.get(m[1]);
      return pi ? send(200, pi) : send(404, { error: { message: "No such payment_intent" } });
    }
    if (req.method === "GET" && url.pathname === "/v1/promotion_codes") {
      const promo = promos[(url.searchParams.get("code") || "").toUpperCase()]; // Stripe matches codes case-insensitively
      return send(200, { data: promo ? [promo] : [] });
    }
    const pm = url.pathname.match(/^\/v1\/prices\/([^/]+)$/);
    if (req.method === "GET" && pm) {
      return prices[pm[1]] ? send(200, prices[pm[1]]) : send(404, { error: { message: "No such price" } });
    }
    send(404, { error: { message: `mock: unhandled ${req.method} ${url.pathname}` } });
  })
  .listen(port, () => console.log(`mock stripe on ${port}`));
