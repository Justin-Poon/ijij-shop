# Backlog

## Go-live (waiting on Stripe phone verification, back from overseas)
Live Stripe is ready: products, JAPLAN10, and a webhook to shop.itsjustinjapan.com (`we_1Ue7BQAg0KVyXnxVL1OMBtNn`, live). To flip:
1. In `wrangler.toml`, set `STRIPE_PRICE_BUNDLE = price_1UeOKMAg0KVyXnxVknA6ZWKE` and `STRIPE_PRICE_UPGRADE = price_1UeOGmAg0KVyXnxVOLfnipdc` (US$30 and US$10; the old A$ live prices are no longer used)
2. Worker secrets: `STRIPE_PUBLISHABLE_KEY` = pk_live, `STRIPE_SECRET_KEY` = sk_live, `STRIPE_WEBHOOK_SECRET` = the live webhook's signing secret (Stripe → Developers → Webhooks)
3. Clear the test orders and events from D1, do one real purchase and refund it, then update the bio links

## Before launch
- [x] 14-day template link checked and saved (21 Nov). 21-day link still needed. Original note: **Planner template links.** Check `canva.link/yfzhz27fc56f3ft` opens as a *template* ("Use template"), not the live 14-day design. Get the 21-day planner's template link (Canva: Share → More → Template link). Add both as Worker secrets `PLANNER_14_URL` and `PLANNER_21_URL`.
- [x] Stripe test keys as Worker secrets: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
- [x] Stripe webhook → `/api/stripe-webhook` (events `payment_intent.succeeded`, `charge.refunded`), secret as `STRIPE_WEBHOOK_SECRET`
- [x] `ADMIN_TOKEN` secret, for the resend tool
- [x] Guide PDF in R2 as `japan-the-complete-guide.pdf`: the 10 Nov export with the new cover, photos recompressed to 1400 px (79 MB → 20 MB). The original is kept in the bucket (21 Nov)
- [x] Resend: add domain `itsjustinjapan.com` (region Tokyo), verify DNS, create a sending key, save as Worker secret `RESEND_API_KEY` (sender `hello@itsjustinjapan.com` is already set)
- [x] Replies: hello@itsjustinjapan.com is a Namecheap Private Email mailbox (read in the Private Email app); Namecheap forwarding DNS removed
- [ ] 21-day upgrade: get its Canva template link, or hide the upgrade at launch
- [x] Rate limits on checkout, quotes and tracking (built in)
- [x] Turnstile bot check on checkout and the review form (site key in `wrangler.toml`, secret `TURNSTILE_SECRET`)
- [x] Analytics: visits, checkouts and orders by source at `/admin` (password = ADMIN_TOKEN)
- [ ] Use `?src=tiktok` and `?src=ig` on the bio links (e.g. `…/?src=tiktok`)
- [x] Billing alert in Cloudflare (Billing → Notifications)
- [x] Test purchase on a phone: payment, webhook and order record all work (18 Nov)
- [ ] Re-test once the PDF, planner links and email are in: email arrives, download works, refund turns the link off
- [x] Decide which payment methods to offer: Stripe currently shows card, Link, Klarna and Zip (Stripe Dashboard → Settings → Payment methods)
- [ ] **Go live** (domain: `shop.itsjustinjapan.com`; itsjustinjapan.com is already on this Cloudflare account)
  - [x] Attach `shop.itsjustinjapan.com` to the `ijij-shop` Worker; set `SITE_URL` to it (21 Nov)
  - [ ] Stripe live mode: products (US$30 bundle, US$10 upgrade), JAPLAN10 coupon + promo code, webhook → `https://shop.itsjustinjapan.com/api/stripe-webhook`
  - [ ] Live keys as Worker secrets (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`); live price IDs in `wrangler.toml`
  - [ ] Stripe → Settings → Payment method domains: add `shop.itsjustinjapan.com` (Apple Pay / Google Pay)
  - [ ] One real purchase with your own card, then refund it
  - [ ] **REMINDER: update the TikTok and Instagram bio links** to `https://shop.itsjustinjapan.com/?src=tiktok` and `https://shop.itsjustinjapan.com/?src=ig`
- [ ] **After the two-week break:** re-export the guide from the "fun" version (v2-fun, 14 Nov) with the new cover and smaller photos, then replace the PDF in R2. Needs `git push origin --all` from the PC first.

## Guide fixes for the next export (from the 21 Nov review)
- [ ] Typo, page 14 (Staying connected): "Free wifi does exists" → "does exist"
- [ ] Welcome (p4): "now that i've finished it" and "like i'd write" → capital I; "hard earned" → "hard-earned"
- [ ] Spill-over pages that hold only a line or a lone tip: 7, 11, 47, 56, 66, 73, 81, 91, 94, 101. Tighten so each section ends on its own page
- [x] Patched into the live PDF (21 Nov), but make the same changes in the guide builder so the next export keeps them: share page (p99) says "Send them to shop.itsjustinjapan.com"; Welcome (p4) and back cover use hello@itsjustinjapan.com; credits name zhgn_ for the cover
- [ ] Back cover: consider the round profile logo instead of the arch badge, to match the cover
- [ ] Daikanyama T-Site photo (Jonathan Lin, Wikimedia Commons): add its licence, e.g. "CC BY-SA 4.0", to the credit, as Creative Commons requires
- [ ] Contents page numbers: re-check after the layout tightening
- [ ] **Guide builder: remove the CSS `box-shadow` on polaroids** (and any other shadowed images). Chrome exports shadows as soft masks that Apple's viewers draw as grey boxes. Already stripped from the live PDF (21 Nov). Consider a hairline border instead, so white frames don't blend into the page

## Before launch: also
- [ ] Confirm the Worker secret `PLANNER_14_URL` is `https://canva.link/t5wsdgpu0rqkl9r` (the new 2027 shop version)
- [ ] The FAQ promises free updates by email ("I'll send you the newest guide"): use Resend in `/admin` when someone asks
- [ ] Keep editing the same Canva planner design (don't make new copies), so existing buyers' links always open the latest version

## Later
- [ ] **21-day planner upgrade.** The copy "21-Day" `DAHbhvqaGgs` already has the outfit, packing and accommodation pages removed. Still to do: apply the price/rating updates and swaps (`edit-spec.json` approach, same as the 14-day), rename it "NEW 2027 SHOP VERSION – 21-Day Japan Travel Planner", make a template link, then set Worker secret `PLANNER_21_URL`. That turns on the US$10 upgrade at checkout.
- [ ] 14-day planner: bold "Reservation:" on the Gyukatsu Motomura card (p44), and add street addresses for Kamado Gohan Ikkoku and Giraffa
- [ ] `www.itsjustinjapan.com` points to a Namecheap parking page: add www as a custom domain on the `itsjustinjapan` Pages project
- [x] Etsy reviews on the shop page (`public/reviews.json`)
- [x] Review flow: `/review` page, approve in `/admin`, approved reviews show on the shop (22 Nov)
- [ ] **Getting the review link to buyers** (nothing sends it yet). Options: a line in the order email (easy, but arrives before the trip); an automatic email ~3 weeks after purchase, or after their trip if checkout asks for travel dates (best, ~1 hour: daily Cron Trigger + email)
- [ ] Follow-up email sequence and buyers added to the email list
- [ ] Order bump #2: shopping guide (~US$10). Checkout currently fits one bump (reserved for the 21-day upgrade); allowing two is a small change
- [ ] Off-the-beaten-path guide as a standalone product / post-purchase upsell (only places you've been)
- [ ] Seasonal guides as free email lead magnets (e.g. cherry blossom 2027)
- [ ] **Illustrations for the guide** (real illustrator, not AI: the FAQ sells first-hand, human picks)
  - Where they help most, where a photo or text can't explain it as well:
    - Intro to Japanese food: a spread of the main dishes (ramen styles, sushi, yakitori, okonomiyaki, tonkatsu, wagyu, desserts) so people know what to look for
    - Tuna guide: akami → chutoro → otoro on one fish, from lean to fattiest, with what each tastes like
    - Konbini picks; onsen steps; chopstick do's and don'ts; IC card and ticket gates; a simple route map for the 14-day trip
  - Start with a pilot of 2–3 pieces (the tuna diagram and the food intro page), then decide on the rest
  - One illustrator and one style for everything, so it feels like a real book
  - Get commercial rights to reuse the art in the PDF, web guide, shop page and social posts
  - Ask for transparent PNG or SVG files so they drop straight into the guide builder
- [ ] Sales page: swipeable previews of real guide and planner pages; "Get the guide" button near the top; collapse the discount box into "Have a code?"
- [ ] Optional: privacy policy line about anonymous visit stats (TikTok/IG attribution uses a 30-day browser ID)
- [ ] Post-purchase upsell (things to do and eat guide)
- [ ] **Web version of the guide** (UI inspired by Blissbook):
  - Every section collapsed by default, so the page is just a list of headings; tap a heading to expand it
  - A menu that expands level by level as you tap it (chapter → section) and jumps straight to that section
  - Works well on a phone, for looking things up on the go in Japan
  - Access only for buyers (e.g. a private link in the order email, or a login), so it isn't freely shared
  - Built from the same content as the PDF (the guide builder), so the two stay in sync
- [ ] Customer accounts (if the web guide needs logins)
- [ ] **New Notion guide** (details to come). The old CTA slide mentions "Notion and PDF versions", so decide whether Notion is a product, a bonus, or replaces the old version

## Waitlist (added 23 Nov 2026)
- [x] /waitlist sign-up (email, optional name and travel month, consent), admin count + CSV export, footer link
- [ ] Put shop.itsjustinjapan.com/waitlist?src=ig (and ?src=tiktok) in the bio alongside the shop link
- [ ] Resend: verify the sending domain (DNS records), create an Audience, import waitlist.csv before launch
- [ ] Optional: send each new sign-up to Resend automatically (needs a RESEND_API_KEY secret) and a welcome email
