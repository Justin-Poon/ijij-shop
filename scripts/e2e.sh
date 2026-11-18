#!/usr/bin/env bash
# End-to-end test against a local Cloudflare runtime and a fake Stripe API.
# Runs: checkout -> webhook -> thank-you lookup -> download -> resend -> refund.
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
  pkill -f "pages dev --port $PORT" 2>/dev/null || true
  pkill -f "socket-addr=entry=localhost:$PORT" 2>/dev/null || true
}
trap cleanup EXIT

node scripts/mock-stripe.mjs $MOCK "$SITE" > /tmp/ijij-mock.log 2>&1 & MOCK_PID=$!

npx wrangler d1 migrations apply ijij-shop --local --persist-to "$STATE" >/dev/null
printf '%%PDF-1.4 fake guide for tests\n' > /tmp/ijij-guide.pdf
npx wrangler r2 object put ijij-shop-files/japan-the-complete-guide.pdf --file /tmp/ijij-guide.pdf --local --persist-to "$STATE" >/dev/null

npx wrangler pages dev --port $PORT --persist-to "$STATE" \
  --binding SITE_URL="$SITE" STRIPE_API_BASE="http://127.0.0.1:$MOCK" STRIPE_SECRET_KEY=sk_test_mock \
  STRIPE_WEBHOOK_SECRET="$WHSEC" STRIPE_PRICE_BUNDLE=price_bundle STRIPE_PRICE_UPGRADE=price_upgrade \
  PLANNER_14_URL="https://canva.example/14" PLANNER_21_URL="https://canva.example/21" ADMIN_TOKEN="$ADMIN" \
  > /tmp/ijij-dev.log 2>&1 & DEV_PID=$!

for i in $(seq 1 60); do curl -sf "$SITE/" >/dev/null && break; sleep 1; done

pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; echo "--- dev log"; tail -30 /tmp/ijij-dev.log; exit 1; }

H=$(curl -sf "$SITE/"); [[ "$H" == *"Get the guide"* ]] && pass "sales page loads" || fail "sales page"
H=$(curl -sf "$SITE/thanks"); [[ "$H" == *"Thank you"* ]] && pass "thank-you page loads" || fail "thanks page"

P=$(curl -sf "$SITE/api/products")
echo "$P" | grep -q '"display":"\$39.00"' && pass "live prices: $P" || fail "products: $P"

# 1. Checkout without the upgrade -> 303 to Stripe
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' -X POST "$SITE/api/checkout" -d '')
[[ "$LOC" == *"/__mock_checkout/cs_test_mock1" ]] && pass "checkout redirects to Stripe" || fail "checkout: $LOC"

# 2. Thank-you lookup fulfils even before the webhook arrives
O=$(curl -sf "$SITE/api/order?session_id=cs_test_mock1")
echo "$O" | grep -q '"status":"paid"' && pass "order fulfilled from thank-you page" || fail "order: $O"
echo "$O" | grep -q 'canva.example/14' && ! echo "$O" | grep -q 'canva.example/21' && pass "14-day only: correct planners" || fail "planners: $O"
DL=$(echo "$O" | sed -E 's/.*"downloadUrl":"([^"]+)".*/\1/')

# 3. Signed webhook for the same session is idempotent (no second order or token)
BODY='{"id":"evt_1","type":"checkout.session.completed","data":{"object":{"id":"cs_test_mock1"}}}'
SIG=$(node --experimental-strip-types --no-warnings -e "import('./src/stripe.ts').then(async m=>console.log(await m.signPayload('$WHSEC', process.argv[1])))" "$BODY")
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/stripe-webhook" -H "Stripe-Signature: $SIG" --data-binary "$BODY")
[[ "$CODE" == 200 ]] && pass "signed webhook accepted" || fail "webhook code $CODE"
O2=$(curl -sf "$SITE/api/order?session_id=cs_test_mock1")
[[ "$(echo "$O2" | sed -E 's/.*"downloadUrl":"([^"]+)".*/\1/')" == "$DL" ]] && pass "repeat fulfilment reuses the same link" || fail "link changed"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/stripe-webhook" -H "Stripe-Signature: t=1,v1=deadbeef" --data-binary "$BODY")
[[ "$CODE" == 400 ]] && pass "forged webhook rejected" || fail "forged webhook code $CODE"

# 4. Download the PDF
curl -sf "$DL" -o /tmp/ijij-dl.pdf && cmp -s /tmp/ijij-dl.pdf /tmp/ijij-guide.pdf && pass "PDF downloads" || fail "download"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/download/$(printf 'a%.0s' {1..48})")
[[ "$CODE" == 404 ]] && pass "unknown download link is 404" || fail "bad token code $CODE"

# 5. Checkout with the 21-day upgrade
LOC=$(curl -s -o /dev/null -w '%{redirect_url}' -X POST "$SITE/api/checkout" -d 'upgrade=1')
O=$(curl -sf "$SITE/api/order?session_id=cs_test_mock2")
echo "$O" | grep -q 'canva.example/21' && pass "upgrade order includes the 21-day planner" || fail "upgrade: $O"

# 6. Admin resend issues a fresh link
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$SITE/api/admin/resend" -d '{"email":"buyer1@example.com"}')
[[ "$CODE" == 401 ]] && pass "resend needs the admin token" || fail "resend auth $CODE"
R=$(curl -sf -X POST "$SITE/api/admin/resend" -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"email":"buyer1@example.com"}')
NEW=$(echo "$R" | sed -E 's/.*"downloadUrl":"([^"]+)".*/\1/')
[[ "$NEW" != "$DL" ]] && curl -sf "$NEW" -o /dev/null && pass "resend gives a working new link" || fail "resend: $R"

# 7. Refund webhook kills the download links
BODY='{"id":"evt_2","type":"charge.refunded","data":{"object":{"payment_intent":"pi_mock1"}}}'
SIG=$(node --experimental-strip-types --no-warnings -e "import('./src/stripe.ts').then(async m=>console.log(await m.signPayload('$WHSEC', process.argv[1])))" "$BODY")
curl -sf -X POST "$SITE/api/stripe-webhook" -H "Stripe-Signature: $SIG" --data-binary "$BODY" >/dev/null
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$NEW")
[[ "$CODE" == 410 ]] && pass "refund disables the download" || fail "after refund code $CODE"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/api/order?session_id=cs_test_mock1")
[[ "$CODE" == 410 ]] && pass "refunded order shows as refunded" || fail "refunded order code $CODE"

echo "All end-to-end checks passed."
