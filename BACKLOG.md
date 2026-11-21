# Backlog

## Before launch
- [x] 14-day template link checked and saved (21 Nov). 21-day link still needed. Original note: **Planner template links.** Check `canva.link/yfzhz27fc56f3ft` opens as a *template* ("Use template"), not the live 14-day design. Get the 21-day planner's template link (Canva: Share → More → Template link). Add both as Worker secrets `PLANNER_14_URL` and `PLANNER_21_URL`.
- [x] Stripe test keys as Worker secrets: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- [x] Stripe webhook → `/api/stripe-webhook` (events `payment_intent.succeeded`, `charge.refunded`), secret as `STRIPE_WEBHOOK_SECRET`
- [x] `ADMIN_TOKEN` secret, for the resend tool
- [ ] Upload the guide PDF to the R2 bucket `ijij-shop-files`. For launch: the 10 Nov export (OneDrive `guide-builder/exports/ijij-japan-guide-final-20261110-0656.pdf`), which Claude then gives the new cover and shrinks
- [ ] Resend: add domain `itsjustinjapan.com` (region Tokyo), verify DNS, create a sending key, save as Worker secret `RESEND_API_KEY` (sender `hello@itsjustinjapan.com` is already set)
- [ ] Cloudflare Email Routing: forward `hello@itsjustinjapan.com` to your inbox so customer replies reach you
- [ ] 21-day upgrade: get its Canva template link, or hide the upgrade at launch
- [x] Rate limits on checkout, quotes and tracking (built in)
- [ ] Turnstile widget: create it in Cloudflare (Turnstile → Add widget, hostname `ijij-shop.contactjustinjapan.workers.dev` + later `shop.<domain>`, mode Managed). Add the site key as `TURNSTILE_SITE_KEY` and the secret key as `TURNSTILE_SECRET` (both Worker secrets)
- [x] Analytics: visits, checkouts and orders by source at `/admin` (password = ADMIN_TOKEN)
- [ ] Use `?src=tiktok` and `?src=ig` on the bio links (e.g. `…/?src=tiktok`)
- [x] Billing alert in Cloudflare (Billing → Notifications)
- [x] Test purchase on a phone: payment, webhook and order record all work (18 Nov)
- [ ] Re-test once the PDF, planner links and email are in: email arrives, download works, refund turns the link off
- [x] Decide which payment methods to offer: Stripe currently shows card, Link, Klarna and Zip (Stripe Dashboard → Settings → Payment methods)
- [ ] **Go live** (domain: `shop.itsjustinjapan.com`; itsjustinjapan.com is already on this Cloudflare account)
  - [x] Attach `shop.itsjustinjapan.com` to the `ijij-shop` Worker; set `SITE_URL` to it (21 Nov)
  - [ ] Stripe live mode: products (A$40 bundle, A$10 upgrade), JAPLAN10 coupon + promo code, webhook → `https://shop.itsjustinjapan.com/api/stripe-webhook`
  - [ ] Live keys as Worker secrets (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`); live price IDs in `wrangler.toml`
  - [ ] Stripe → Settings → Payment method domains: add `shop.itsjustinjapan.com` (Apple Pay / Google Pay)
  - [ ] One real purchase with your own card, then refund it
  - [ ] **REMINDER: update the TikTok and Instagram bio links** to `https://shop.itsjustinjapan.com/?src=tiktok` and `https://shop.itsjustinjapan.com/?src=ig`
- [ ] **After the two-week break:** re-export the guide from the "fun" version (v2-fun, 14 Nov) with the new cover and smaller photos, then replace the PDF in R2. Needs `git push origin --all` from the PC first.

## Later
- [ ] Real customer reviews in `public/reviews.json` (e.g. Etsy reviews)
- [ ] Follow-up email sequence and buyers added to the email list
- [ ] Post-purchase upsell (things to do and eat guide)
- [ ] Customer accounts and the web version of the guide + Planner
