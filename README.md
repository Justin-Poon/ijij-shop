# IJIJ shop

The storefront for *Japan: the complete guide*. One sales page, Stripe checkout, automatic delivery.

**What it sells (MVP):** the guide (PDF) plus the 14-day Canva planner, with a tick-box upgrade to add the 21-day planner.

## How it works

```
Sales page (/)  --form post-->  /api/checkout  --303-->  Stripe Checkout
                                                              |
                     Stripe webhook  <------------------------+
                     /api/stripe-webhook                      |
                            |                                 v
                            +--> fulfil()  <---  /thanks?session_id=...  (polls /api/order)
                                   |
                                   +--> order saved in D1
                                   +--> download link (expires, limited downloads)
                                   +--> delivery email (Resend)

/download/<token>  --> streams the PDF from R2
```

- **Cloudflare Pages** hosts the pages (`public/`) and the server code (`functions/`).
- **D1** (Cloudflare's SQLite) stores orders and download links (`migrations/`).
- **R2** (Cloudflare's file storage) holds the guide PDF privately. Buyers only get it through an expiring link.
- **Stripe** handles payment, promo codes, receipts and refunds. No card data touches this code.
- **Resend** sends the delivery email. Without a key, emails are skipped and logged, which is handy for testing.

Fulfilment runs from both the webhook and the thank-you page, whichever comes first. It's idempotent, so a buyer never gets two orders or two emails, and a slow or misconfigured webhook doesn't leave anyone without their download.

Prices live in Stripe, not in code. Change a price in the Stripe dashboard (as a new Price), update the price ID secret, and the page shows it within five minutes.

## Endpoints

| Route | What it does |
| --- | --- |
| `GET /` | Sales page |
| `POST /api/checkout` | Creates a Stripe Checkout session. Form field `upgrade=1` adds the 21-day planner |
| `POST /api/stripe-webhook` | Stripe events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded` |
| `GET /thanks?session_id=` | Thank-you page with the downloads |
| `GET /api/order?session_id=` | Used by the thank-you page |
| `GET /download/:token` | The PDF, if the link is valid (60 days, 15 downloads by default) |
| `GET /api/products` | Current prices from Stripe (cached 5 minutes) |
| `POST /api/admin/resend` | `Authorization: Bearer <ADMIN_TOKEN>`, body `{"email": "..."}`. Fresh link + email for a customer |

A refund in Stripe automatically turns off that order's download links.

## Setting it up

You need: the Stripe account, a Cloudflare account (the one your domain is on), and a free [Resend](https://resend.com) account.

### 1. Stripe (start in test mode)
1. **Products:** create two products, each with a one-off price:
   - "Japan guide + 14-day planner" (the bundle)
   - "Upgrade: 21-day planner" (the add-on)

   Copy both price IDs (`price_...`).
2. **Promo code:** Products → Coupons → create 10% off, then add the promotion code `JAPLAN10`.
3. **Webhook:** Developers → Webhooks → add an endpoint `https://shop.<your-domain>/api/stripe-webhook` with the three events above. Copy the signing secret (`whsec_...`).
4. **Branding:** Settings → Branding: add the logo and colour `#6b1234` so Checkout matches the shop.

### 2. Cloudflare
```bash
npm install
npx wrangler login
npx wrangler d1 create ijij-shop            # paste the database_id into wrangler.toml
npx wrangler r2 bucket create ijij-shop-files
npm run db:migrate:remote
npx wrangler r2 object put ijij-shop-files/japan-the-complete-guide.pdf --file <path-to-final-guide.pdf> --remote
npx wrangler pages project create ijij-shop
```

Then, in the Cloudflare dashboard, open Pages → ijij-shop → Settings:

- **Variables and secrets:**
  - Set `SITE_URL` to `https://shop.<your-domain>`.
  - Set `EMAIL_FROM` to something like `Justin <hello@your-domain>`.
  - Add the secrets from `.dev.vars.example`.
- **Bindings:** D1 `DB` → `ijij-shop`, and R2 `FILES` → `ijij-shop-files`.
- **Custom domains:** add `shop.<your-domain>`. Your existing site stays where it is.

Deploy with `npm run deploy`, or connect the GitHub repo in Pages so every push deploys.

### 3. Resend
Add your domain, then add the DNS records it gives you in Cloudflare. Create an API key and save it as the `RESEND_API_KEY` secret.

### 4. Test, then go live
1. Buy with Stripe's test card `4242 4242 4242 4242`.
2. Check you get the email, the download works, and a refund in Stripe kills the link.
3. Repeat the Stripe steps in live mode and swap in the live keys, price IDs and webhook secret.

## Local development

```bash
cp .dev.vars.example .dev.vars   # fill in Stripe TEST keys
npm run db:migrate:local
npx wrangler r2 object put ijij-shop-files/japan-the-complete-guide.pdf --file guide.pdf --local
npm run dev                       # http://localhost:8788
stripe listen --forward-to localhost:8788/api/stripe-webhook   # optional, Stripe CLI
```

## Tests

```bash
npm test            # unit tests (Stripe signature checks, form encoding)
npm run typecheck
npm run e2e         # full flow on a local Cloudflare runtime against a fake Stripe API
```

The end-to-end run covers:
- checkout with and without the upgrade
- fulfilment from both the thank-you page and the webhook, with no duplicates
- forged webhooks being rejected
- the PDF download
- admin resend
- refunds turning off downloads

## Roadmap

- **Phase 2:** a follow-up email sequence, adding buyers to the email list, and a post-purchase upsell (the places guide).
- **Phase 3:** customer accounts and the web version of the guide with a saveable Planner. The `orders` table becomes the source of who has access.

## Notes

- The sales-page copy is a first draft. Edit `public/index.html`.
- The Canva planner links are secrets (`PLANNER_14_URL`, `PLANNER_21_URL`). Use the **template** links, never the live designs.
