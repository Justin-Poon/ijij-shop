# IJIJ shop

The storefront for *Japan: the complete guide*. One product page with the checkout built in, and automatic delivery.

**What it sells (MVP):** the guide (PDF) plus the 14-day Canva planner, with a tick-box upgrade to add the 21-day planner.

The page follows the layout of a Stan Store product page:
- a creator card
- a cover image, title and price
- a description with a "what's inside" list
- a reviews carousel
- a "Grab your copy" checkout at the bottom of the same page: name, email, marketing opt-in, the 21-day bump, a discount code, a live total, and Stripe's card / Apple Pay / Google Pay form

Buyers never leave the page to pay.

## How it works

```
Product page (/)
  ├─ GET  /api/config   prices + Stripe publishable key
  ├─ POST /api/quote    live total; checks discount codes against Stripe
  └─ POST /api/intent   creates the Stripe PaymentIntent (amount worked out on the server)
        └─ Stripe.js confirms the payment in the page, then sends the buyer to /thanks
                                                                        │
  Stripe webhook  /api/stripe-webhook  ──┐                              │
                                         ├──> fulfil()  <── /api/order (from /thanks)
                                         │      ├─ order saved in D1
                                         │      ├─ download link (expires, limited downloads)
                                         │      └─ delivery email (Resend)
/download/<token>  ──> streams the PDF from R2
```

- **Cloudflare Pages** hosts the pages (`public/`) and the server code (`functions/`).
- **D1** (Cloudflare's SQLite) stores orders and download links (`migrations/`).
- **R2** (Cloudflare's file storage) holds the guide PDF privately. Buyers only get it through an expiring link.
- **Stripe** takes the payment. Card details go straight from Stripe's form to Stripe and never touch this code.
- **Resend** sends the delivery email. Without a key, emails are skipped and logged, which is handy for testing.

The amount charged is always calculated on the server from Stripe's prices and promotion codes, so nothing the browser sends can change it.

Fulfilment runs from both the webhook and the thank-you page, whichever comes first. It's idempotent, so a buyer never gets two orders or two emails, and a slow webhook doesn't leave anyone without their download. The thank-you page needs the payment's client secret, which Stripe only gives the buyer, so nobody else can look up someone's download.

Prices live in Stripe, not in code. To change one, add a new Price in the Stripe dashboard and update the price ID secret. The page shows it within five minutes.

## Endpoints

| Route | What it does |
| --- | --- |
| `GET /` | Product page with checkout |
| `GET /api/config` | Prices and the publishable key (cached 5 minutes) |
| `POST /api/quote` | `{upgrade, code}` → subtotal, discount, total, or why the code was refused |
| `POST /api/intent` | `{name, email, marketing, upgrade, code}` → client secret for Stripe.js |
| `POST /api/stripe-webhook` | Stripe events: `payment_intent.succeeded`, `charge.refunded` |
| `GET /thanks` | Thank-you page with the downloads (Stripe adds the payment details to the URL) |
| `GET /api/order` | Used by the thank-you page |
| `GET /download/:token` | The PDF, if the link is valid (60 days, 15 downloads by default) |
| `POST /api/admin/resend` | `Authorization: Bearer <ADMIN_TOKEN>`, body `{"email": "..."}`. Fresh link + email for a customer |

A refund in Stripe automatically turns off that order's download links.

## Editing the page

- **Copy:** `public/index.html`. The description is a first draft in Justin's voice. Check it against the style guide.
- **Reviews:** add real ones to `public/reviews.json` as `[{"name": "Sarah K.", "stars": 5, "text": "..."}]`. The section stays hidden while the file is an empty list. Only use genuine customer reviews (Etsy reviews are fine, with first name and initial).
- **Cover:** the cover is drawn in CSS. To use a proper mockup, put `cover.png` in `public/` and swap the `.cover-wrap` contents for `<img src="/cover.png" alt="...">`.
- **Look:** `public/styles.css`, with brand colours at the top.

## Setting it up

You need: the Stripe account, a Cloudflare account (the one your domain is on), and a free [Resend](https://resend.com) account.

### 1. Stripe (start in test mode)
1. **Products:** create two products, each with a one-off price:
   - "Japan guide + 14-day planner" (the bundle)
   - "Upgrade: 21-day planner" (the add-on)

   Copy both price IDs (`price_...`).
2. **Promo code:** Products → Coupons → create 10% off, then add the promotion code `JAPLAN10`.
3. **Webhook:** Developers → Webhooks → add an endpoint `https://shop.<your-domain>/api/stripe-webhook` with the two events above. Copy the signing secret (`whsec_...`).
4. **Keys:** Developers → API keys. Copy the publishable key (`pk_...`) and the secret key (`sk_...`).
5. **Apple Pay / Google Pay:** Settings → Payment methods → Payment method domains → add `shop.<your-domain>`. Without this, the wallet buttons won't show.
6. **Receipts:** Settings → Customer emails → turn on successful-payment receipts, and add the logo and colour `#6b1234` under Branding.

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
1. Buy with Stripe's test card `4242 4242 4242 4242`. Also try `4000 0025 0000 3155`, which triggers the bank-check (3D Secure) popup.
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
npm test            # unit tests (webhook signatures, form encoding, discount maths)
npm run typecheck
npm run e2e         # full flow on a local Cloudflare runtime against a fake Stripe API
```

The end-to-end run covers:
- prices and live totals, including the upgrade
- discount codes: valid, lowercase, unknown, expired, and a 100% code (refused, because Stripe can't charge $0)
- that the browser can't change the amount
- that unpaid or someone else's payments give no download
- fulfilment from both the thank-you page and the webhook, with no duplicates
- forged webhooks being rejected
- the opt-in and discount code being saved with the order
- the PDF download, admin resend, and refunds turning off downloads

## Roadmap

- **Phase 2:** a follow-up email sequence, adding buyers to the email list, and a post-purchase upsell (the places guide).
- **Phase 3:** customer accounts and the web version of the guide with a saveable Planner. The `orders` table becomes the source of who has access.

## Notes

- Discount codes are managed in Stripe (Products → Coupons → promotion codes). Because the checkout uses PaymentIntents rather than Stripe's hosted Checkout, Stripe doesn't count redemptions automatically. A "max redemptions" limit therefore won't trigger, though expiry dates and minimum amounts do. Each order records the code it used.
- The Canva planner links are secrets (`PLANNER_14_URL`, `PLANNER_21_URL`). Use the **template** links, never the live designs.

## Cover

- **Shop images:** `public/cover.webp` and `public/cover.jpg` show the cover on the product page. `public/og-image.jpg` is the link preview for social sites.
- **Print files:** `assets/itsjustinjapan-guide-cover-2027-print.jpg` (2480 × 3508, A4 at 300 dpi) and `assets/cover-print.pdf` (A4, with vector text).
- **Photo credit:** the cover photo is by **zhgn_ on Unsplash** (photo `_7RtWTAXvms`), used under the Unsplash licence. The sky was extended upward and the photo cropped to A4. Credit it on the guide's Photo credits page.
