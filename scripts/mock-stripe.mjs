// A tiny fake Stripe API for local end-to-end tests. Not used in production.
// Usage: node scripts/mock-stripe.mjs <port> <site_url>
import http from "node:http";

const port = Number(process.argv[2] || 12111);
const site = process.argv[3] || "http://localhost:8788";
const sessions = new Map();
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
    if (req.headers.authorization !== "Bearer sk_test_mock") return send(401, { error: { message: "bad key" } });

    if (req.method === "POST" && url.pathname === "/v1/checkout/sessions") {
      const p = await readBody(req);
      const id = `cs_test_mock${++n}`;
      const items = [];
      for (let i = 0; p.has(`line_items[${i}][price]`); i++) items.push(p.get(`line_items[${i}][price]`));
      const amount = items.reduce((s, pid) => s + prices[pid].unit_amount, 0);
      const email = url.searchParams.get("email") || `buyer${n}@example.com`;
      sessions.set(id, {
        id,
        status: "complete",
        payment_status: "paid",
        amount_total: amount,
        currency: "aud",
        payment_intent: `pi_mock${n}`,
        customer_details: { email, name: "Test Buyer" },
        total_details: { amount_discount: 0 },
        line_items: { data: items.map((pid) => ({ price: { id: pid }, quantity: 1 })) },
        _success: p.get("success_url"),
      });
      return send(200, { id, url: `${site}/__mock_checkout/${id}` });
    }
    const m = url.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)$/);
    if (req.method === "GET" && m) {
      const s = sessions.get(m[1]);
      return s ? send(200, s) : send(404, { error: { message: "No such checkout.session" } });
    }
    const pm = url.pathname.match(/^\/v1\/prices\/([^/]+)$/);
    if (req.method === "GET" && pm) {
      return prices[pm[1]] ? send(200, prices[pm[1]]) : send(404, { error: { message: "No such price" } });
    }
    send(404, { error: { message: `mock: unhandled ${req.method} ${url.pathname}` } });
  })
  .listen(port, () => console.log(`mock stripe on ${port}`));
