#!/usr/bin/env bash
# End-to-end test against a local Cloudflare runtime and a fake Stripe API.
# Runs: quote/discounts -> payment -> thank-you lookup -> webhook -> download -> resend -> refund.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=8799
MOCK=12111
SITE="http://localhost:$PORT"
STATE=".wrangler/e2e"
WHSEC="whsec_e2e_secret"
ADMIN="e2e-admin-token"
rm -rf "$STATE"

cleanup() {
  kill "${MOCK_PID:-}" "${DEV_PID:-}" 2>/dev/null || true
  pkill -f "wrangler dev --port $PORT" 2>/dev/null || true
  pkill -f "socket-addr=entry=localhost:$PORT" 2>/dev/null || true
}
trap cleanup EXIT

node scripts/mock-stripe.mjs $MOCK "$SITE" > /tmp/ijij-mock.log 2>&1 & MOCK_PID=$!

npx wrangler d1 migrations apply ijij-shop --local --persist-to "$STATE" >/dev/null
printf '%%PDF-1.4 fake guide for tests\n' > /tmp/ijij-guide.pdf
npx wrangler r2 object put ijij-shop-files/japan-the-complete-guide.pdf --file /tmp/ijij-guide.pdf --local --persist-to "$STATE" >/dev/null

npx wrangler dev --port $PORT --persist-to "$STATE" \
  --var SITE_URL:"$SITE" --var STRIPE_API_BASE:"http://127.0.0.1:$MOCK" --var STRIPE_SECRET_KEY:sk_test_mock --var STRIPE_PUBLISHABLE_KEY:pk_test_mock \
  --var STRIPE_WEBHOOK_SECRET:"$WHSEC" --var STRIPE_PRICE_BUNDLE:price_bundle --var STRIPE_PRICE_UPGRADE:price_upgrade \
  --var PLANNER_14_URL:"https://canva.example/14" --var PLANNER_21_URL:"https://canva.example/21" --var ADMIN_TOKEN:"$ADMIN" \
  > /tmp/ijij-dev.log 2>&1 & DEV_PID=$!

for i in $(seq 1 60); do curl -sf "$SITE/" >/dev/null && break; sleep 1; done

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; echo "--- dev log"; tail -30 /tmp/ijij-dev.log; exit 1; }

H=$(curl -sf "$SITE/"); [[ "$H" == *"Grab your copy"* && "$H" == *"payment-element"* ]] && pass "sales page loads" || fail "sales page"
H=$(curl -sf "$SITE/thanks"); [[ "$H" == *"Thank you"* ]] && pass "thank-you page loads" || fail "thanks page"

MOCKURL="http://127.0.0.1:$MOCK"
post() { curl -s -X POST "$SITE$1" -H 'Content-Type: application/json' -d "$2"; }
field() { node -e 'const o=JSON.parse(process.argv[1]); console.log(process.argv[2].split(".").reduce((a,k)=>a?.[k],o) ?? "")' "$1" "$2"; }
sign() { node --experimental-strip-types --no-warnings -e "import('./src/stripe.ts').then(async m=>console.log(await m.signPayload('$WHSEC', process.argv[1])))" "$1"; }

C=$(curl -sf "$SITE/api/config")
[[ "$(field "$C" bundle.display)" == "A\$39" && "$(field "$C" upgrade.display)" == "A\$10" && "$(field "$C" publishableKey)" == pk_test_mock ]] && pass "config: prices + publishable key" || fail "config: $C"

# Quotes and discount codes
Q=$(post /api/quote '{"upgrade":false}');               [[ "$(field "$Q" total)" == 3900 ]] && pass "quote: bundle = 3900" || fail "quote $Q"
Q=$(post /api/quote '{"upgrade":true}');                [[ "$(field "$Q" total)" == 4900 ]] && pass "quote: with upgrade = 4900" || fail "quote $Q"
Q=$(post /api/quote '{"upgrade":true,"code":"JAPLAN10"}'); [[ "$(field "$Q" total)" == 4410 && "$(field "$Q" code)" == JAPLAN10 ]] && pass "JAPLAN10 takes 10% off (4410)" || fail "promo $Q"
Q=$(post /api/quote '{"upgrade":false,"code":"NOPE"}');  [[ "$(field "$Q" total)" == 3900 && -n "$(field "$Q" codeError)" ]] && pass "unknown code rejected: $(field "$Q" codeError)" || fail "bad code $Q"
Q=$(post /api/quote '{"upgrade":false,"code":"OLDCODE"}'); [[ "$(field "$Q" codeError)" == *expired* ]] && pass "expired code rejected" || fail "expired $Q"
Q=$(post /api/quote '{"upgrade":false,"code":"FREEBIE"}'); [[ "$(field "$Q" total)" == 3900 && -n "$(field "$Q" codeError)" ]] && pass "100% code can't zero the charge" || fail "free $Q"

# Validation
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/intent" -H 'Content-Type: application/json' -d '{"name":"A","email":"not-an-email"}')
[[ "$CODE" == 400 ]] && pass "bad email rejected" || fail "bad email $CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/intent" -H 'Content-Type: application/json' -d '{"name":"A","email":"a@b.com","code":"NOPE"}')
[[ "$CODE" == 400 ]] && pass "intent with bad code rejected" || fail "bad code intent $CODE"

# 1. Buy without the upgrade, with JAPLAN10. Amount comes from the server, not the browser.
I=$(post /api/intent '{"name":"Test Buyer","email":"Buyer1@Example.com","marketing":true,"upgrade":false,"code":"japlan10","amount":1}')
[[ "$(field "$I" amount)" == 3510 ]] && pass "payment created for 3510 (server-side amount)" || fail "intent $I"
SECRET=$(field "$I" clientSecret); PI=${SECRET%%_secret_*}

O=$(curl -s "$SITE/api/order?payment_intent=$PI&payment_intent_client_secret=$SECRET")
[[ "$(field "$O" status)" == failed ]] && pass "unpaid payment gives no download" || fail "unpaid: $O"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/api/order?payment_intent=$PI&payment_intent_client_secret=wrong")
[[ "$CODE" == 404 ]] && pass "wrong client secret can't see the order" || fail "secret check $CODE"

curl -sf -X POST "$MOCKURL/__succeed/$PI" >/dev/null
O=$(curl -sf "$SITE/api/order?payment_intent=$PI&payment_intent_client_secret=$SECRET")
[[ "$(field "$O" status)" == paid && "$(field "$O" email)" == buyer1@example.com ]] && pass "paid: thank-you page fulfils" || fail "order: $O"
[[ "$O" == *canva.example/14* && "$O" != *canva.example/21* ]] && pass "14-day only: correct planners" || fail "planners: $O"
DL=$(field "$O" downloadUrl)

# 2. Signed webhook for the same payment is idempotent
BODY="{\"id\":\"evt_1\",\"type\":\"payment_intent.succeeded\",\"data\":{\"object\":{\"id\":\"$PI\"}}}"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/stripe-webhook" -H "Stripe-Signature: $(sign "$BODY")" --data-binary "$BODY")
[[ "$CODE" == 200 ]] && pass "signed webhook accepted" || fail "webhook code $CODE"
O2=$(curl -sf "$SITE/api/order?payment_intent=$PI&payment_intent_client_secret=$SECRET")
[[ "$(field "$O2" downloadUrl)" == "$DL" ]] && pass "repeat fulfilment reuses the same link" || fail "link changed"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/stripe-webhook" -H "Stripe-Signature: t=1,v1=deadbeef" --data-binary "$BODY")
[[ "$CODE" == 400 ]] && pass "forged webhook rejected" || fail "forged webhook code $CODE"

ROW=$(npx wrangler d1 execute ijij-shop --local --persist-to "$STATE" --json --command "SELECT marketing, promo_code, discount, amount_total FROM orders WHERE id='$PI'" 2>/dev/null)
[[ "$ROW" == *'"marketing": 1'* && "$ROW" == *'"promo_code": "JAPLAN10"'* && "$ROW" == *'"amount_total": 3510'* ]] && pass "order saved with opt-in, code and amount" || fail "row: $ROW"

# 3. Download the PDF
curl -sf "$DL" -o /tmp/ijij-dl.pdf && cmp -s /tmp/ijij-dl.pdf /tmp/ijij-guide.pdf && pass "PDF downloads" || fail "download"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/download/$(printf 'a%.0s' {1..48})")
[[ "$CODE" == 404 ]] && pass "unknown download link is 404" || fail "bad token code $CODE"

# 4. Webhook-first order with the 21-day upgrade
I=$(post /api/intent '{"name":"Second Buyer","email":"buyer2@example.com","upgrade":true}')
SECRET2=$(field "$I" clientSecret); PI2=${SECRET2%%_secret_*}
[[ "$(field "$I" amount)" == 4900 ]] && pass "upgrade payment is 4900" || fail "intent2 $I"
curl -sf -X POST "$MOCKURL/__succeed/$PI2" >/dev/null
BODY="{\"id\":\"evt_2\",\"type\":\"payment_intent.succeeded\",\"data\":{\"object\":{\"id\":\"$PI2\"}}}"
curl -sf -X POST "$SITE/api/stripe-webhook" -H "Stripe-Signature: $(sign "$BODY")" --data-binary "$BODY" >/dev/null
O=$(curl -sf "$SITE/api/order?payment_intent=$PI2&payment_intent_client_secret=$SECRET2")
[[ "$O" == *canva.example/21* ]] && pass "upgrade order includes the 21-day planner" || fail "upgrade: $O"

# 5. Admin resend issues a fresh link
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/admin/resend" -d '{"email":"buyer1@example.com"}')
[[ "$CODE" == 401 ]] && pass "resend needs the admin token" || fail "resend auth $CODE"
R=$(curl -sf -X POST "$SITE/api/admin/resend" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"email":"buyer1@example.com"}')
NEW=$(field "$R" downloadUrl)
[[ -n "$NEW" && "$NEW" != "$DL" ]] && curl -sf "$NEW" -o /dev/null && pass "resend gives a working new link" || fail "resend: $R"

# 6. Refund webhook kills the download links
BODY="{\"id\":\"evt_3\",\"type\":\"charge.refunded\",\"data\":{\"object\":{\"payment_intent\":\"$PI\"}}}"
curl -sf -X POST "$SITE/api/stripe-webhook" -H "Stripe-Signature: $(sign "$BODY")" --data-binary "$BODY" >/dev/null
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$NEW")
[[ "$CODE" == 410 ]] && pass "refund disables the download" || fail "after refund code $CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/api/order?payment_intent=$PI&payment_intent_client_secret=$SECRET")
[[ "$CODE" == 410 ]] && pass "refunded order shows as refunded" || fail "refunded order code $CODE"

# 7. Analytics: views and purchases attributed to a source; stats need the admin token
IG_UA="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/22A3354 Instagram 350.0.0.0.0"
T=$(curl -s -X POST "$SITE/api/track" -H 'Content-Type: application/json' -H "User-Agent: Mozilla/5.0 Safari" -d '{"source":"tt","visitor":"visitor_tiktok_1"}')
[[ "$(field "$T" source)" == tiktok ]] && pass "view tagged tiktok from ?src=tt" || fail "track: $T"
T=$(curl -s -X POST "$SITE/api/track" -H 'Content-Type: application/json' -H "User-Agent: $IG_UA" -d '{"visitor":"visitor_insta_1"}')
[[ "$(field "$T" source)" == instagram ]] && pass "Instagram in-app browser recognised" || fail "ig track: $T"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/track" -H 'Content-Type: application/json' -H "User-Agent: facebookexternalhit/1.1" -d '{}')
[[ "$CODE" == 204 ]] && pass "link-preview bots aren't counted" || fail "bot track $CODE"
I=$(curl -s -X POST "$SITE/api/intent" -H 'Content-Type: application/json' -H "User-Agent: Mozilla/5.0 Safari" -d '{"name":"Tok Buyer","email":"tok@example.com","source":"tiktok","visitor":"visitor_tiktok_1"}')
SECRET3=$(field "$I" clientSecret); PI3=${SECRET3%%_secret_*}
curl -sf -X POST "$MOCKURL/__succeed/$PI3" >/dev/null
curl -sf "$SITE/api/order?payment_intent=$PI3&payment_intent_client_secret=$SECRET3" >/dev/null
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/api/admin/stats")
[[ "$CODE" == 401 ]] && pass "stats need the admin token" || fail "stats auth $CODE"
S=$(curl -sf "$SITE/api/admin/stats?days=7" -H "Authorization: Bearer $ADMIN")
TT=$(node -e 'const d=JSON.parse(process.argv[1]);const r=d.sources.find(s=>s.source==="tiktok");console.log([r.visitors,r.checkouts,r.orders,r.revenue,r.conversion].join(","))' "$S")
[[ "$TT" == "1,1,1,3900,1" ]] && pass "stats: tiktok 1 visitor → 1 checkout → 1 order, 100%" || fail "stats tiktok: $TT / $S"
IG=$(node -e 'const d=JSON.parse(process.argv[1]);const r=d.sources.find(s=>s.source==="instagram");console.log([r.visitors,r.orders].join(","))' "$S")
[[ "$IG" == "1,0" ]] && pass "stats: instagram 1 visitor, 0 orders" || fail "stats ig: $IG"
H=$(curl -sf "$SITE/admin"); [[ "$H" == *"Shop stats"* ]] && pass "stats page loads" || fail "admin page"
H=$(curl -sf "$SITE/policies"); [[ "$H" == *"Refunds"* && "$H" == *"Australian Consumer Law"* ]] && pass "policies page loads" || fail "policies page"
[[ "$(field "$C" upgrade.available)" == true ]] && pass "upgrade offered when the 21-day link is set" || fail "upgrade availability: $C"

echo "All end-to-end checks passed."
