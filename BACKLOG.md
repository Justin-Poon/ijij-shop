# Backlog

## Before launch
- [ ] **Planner template links.** Check `canva.link/yfzhz27fc56f3ft` opens as a *template* ("Use template"), not the live 14-day design. Get the 21-day planner's template link (Canva: Share → More → Template link). Add both as Worker secrets `PLANNER_14_URL` and `PLANNER_21_URL`.
- [ ] Stripe test keys as Worker secrets: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- [ ] Stripe webhook → `/api/stripe-webhook` (events `payment_intent.succeeded`, `charge.refunded`), secret as `STRIPE_WEBHOOK_SECRET`
- [ ] `ADMIN_TOKEN` secret, for the resend tool
- [ ] Upload the final guide PDF to the R2 bucket `ijij-shop-files` as `japan-the-complete-guide.pdf`
- [ ] Resend account + `RESEND_API_KEY`; set `EMAIL_FROM` to a real address on your domain
- [ ] Bot protection: Cloudflare Turnstile on Purchase, plus a rate limit on `/api/intent`
- [ ] Billing alert in Cloudflare (Billing → Notifications)
- [ ] Full test purchase on a phone (card 4242 4242 4242 4242): email, download, refund
- [ ] Go live: Stripe live products/prices/JAPLAN10/webhook, live keys, custom domain `shop.<your-domain>`

## Later
- [ ] Real customer reviews in `public/reviews.json` (e.g. Etsy reviews)
- [ ] Follow-up email sequence and buyers added to the email list
- [ ] Post-purchase upsell (things to do and eat guide)
- [ ] Customer accounts and the web version of the guide + Planner
