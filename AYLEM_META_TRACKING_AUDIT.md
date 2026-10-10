# Aylem Learning Meta Ads Tracking Audit

Audit date: 2026-10-10  
Scope: read-only code inspection plus safe local verification. No code, production config, database records, Cashfree state, Meta dataset, or deployments were modified.

## 1. Executive Summary

Launch readiness: **READY WITH WARNINGS**.

The repository implements a React/Vite storefront on Cloudflare Pages Functions with Cashfree checkout, D1/KV order storage, Google Tag Manager browser tracking, and a server-side Meta Conversions API Purchase sender.

The strongest finding is positive: server-side Purchase is only emitted from backend paths that first verify or already hold a `PAID` order. Amounts are server-calculated in integer paise, persisted before Cashfree checkout, validated against Cashfree payment amount/currency, and converted to rupees before Meta CAPI. This makes the reported "same price" warning likely explainable by identical digital product purchases, not by a hardcoded Purchase value, for ordinary checkout flows.

Primary warnings:

- **P1: Duplicate CAPI Purchase sends are possible** from `order-status` polling/refresh and duplicate paid webhooks. The same deterministic `event_id` should allow Meta deduplication, but the server still retransmits repeatedly.
- **P1: Browser Purchase depends on GTM configuration not present in the repo.** The app pushes `dataLayer` purchase events with matching `event_id`, but actual Meta Pixel tags live in the GTM container and require Events Manager/GTM access to fully verify.
- **P2: PageView CAPI coverage warning is expected from this codebase.** There is no server-side PageView sender; only Purchase is sent via CAPI.
- **P2: Webhook CAPI sends lack request context.** Purchases sent from webhooks include hashed email/phone/name but do not include `_fbp`, `_fbc`, client IP, user agent, or event source URL derived from the browser request.

## 2. Architecture Map

Browser page load -> `index.html` loads Google Tag Manager `GTM-MSSH84F2` on all pages (`index.html:4-10`, `index.html:52-55`). No direct `fbq`, `fbevents.js`, or `facebook.com/tr` snippet exists in the repository.

React app -> product, cart, checkout, and purchase actions push ecommerce events to `window.dataLayer` in `src/utils/analytics.ts:109-123`, `160-183`, and `185-264`. GTM must translate these into Meta browser events.

Checkout -> `src/views/CheckoutView.tsx:393-421` calls `/api/create-cashfree-order`, loads Cashfree SDK, then redirects through Cashfree.

Order creation -> `functions/api/create-cashfree-order.js:92-127` deletes client-supplied price fields, `187-199` computes server-authoritative price, `226-246` saves a PENDING order with amount in paise, and `289-301` sends Cashfree `order_amount` in rupees and `order_currency: INR`.

Cashfree return -> `/order-success` calls `/api/order-status` (`src/views/OrderSuccessView.tsx:124-188`). The backend verifies Cashfree before marking unpaid orders PAID (`functions/api/order-status.js:136-165`).

Cashfree webhook -> verified by HMAC and timestamp (`functions/api/cashfree-webhook.js:54-95`), then success events validate currency and amount before marking PAID (`229-286`).

Meta CAPI -> `functions/utils/metaCapi.js:74-171` sends only `Purchase` to Graph API. Dataset defaults to `1066331326319035` (`functions/utils/metaCapi.js:8`) unless `META_PIXEL_ID` is set.

## 3. Event Tracking Matrix

| Event | Browser implementation | Server CAPI | Trigger | Value/currency | Deduplication | Status |
|---|---|---|---|---|---|---|
| PageView | Not directly in repo; likely GTM pageview tag from `index.html:4-10` | No implementation found | Page load / SPA route if GTM configured | Requires GTM access | Unknown | Browser-only by code evidence |
| ViewContent | `view_item` dataLayer push at `src/utils/analytics.ts:160-163`; triggered from `ProductDetailView.tsx:64-70` | No | Product detail render | Product price, INR in ecommerce object | Random dataLayer `event_id` from `analytics.ts:105-115`; no server match | Implemented browser-side only |
| AddToCart | `add_to_cart` dataLayer push at `analytics.ts:165-176`; app analytics event at `312-323` | No | Add to cart and buy now handlers at `ProductDetailView.tsx:150-158`; cart context also pushes at `ShopContext.tsx:751-753`, `802` | Cart item prices, INR | Random dataLayer ID; no CAPI match | Implemented browser-side only; possible duplicate if both product handler and context emit for same click |
| InitiateCheckout | `begin_checkout` dataLayer push at `analytics.ts:178-183`; app event at `346-357` | No | Checkout view with non-empty cart at `CheckoutView.tsx:193-203` | Cart-derived value, INR | In-memory flag for app event; dataLayer push fires when `cart.length` effect runs | Implemented browser-side only |
| AddPaymentInfo | No code evidence found | No | Not implemented | N/A | N/A | Not implemented |
| Purchase | `purchase` dataLayer push at `analytics.ts:185-264`, triggered after `/api/order-status` returns PAID in `OrderSuccessView.tsx:183-188` and `App.tsx:116-121` | Yes, `sendMetaPurchaseEvent` | Successful server-verified order status or paid webhook | `order.amount_paise / 100`, INR by default | Browser/server both use `purchase_${order.id}` (`analytics.ts:208`, `metaCapi.js:90`) | Implemented; dedup ID is correct, but server resends from multiple paths |

## 4. Purchase Lifecycle Analysis

1. Product detail loads and emits product view events from `ProductDetailView.tsx:64-70`.
2. Add to cart/buy now triggers app analytics and dataLayer add-to-cart events at `ProductDetailView.tsx:150-158`; cart context also emits at `ShopContext.tsx:751-753`.
3. Checkout page emits checkout-started events at `CheckoutView.tsx:193-203`.
4. Payment initiation calls `createCashfreeOrder` at `CheckoutView.tsx:393-401`.
5. The client sends only intent fields, not prices, from `src/utils/cashfree.ts:110-141`.
6. The server strips forbidden amount fields (`create-cashfree-order.js:92-127`), computes price server-side (`187-199`), saves a PENDING order (`226-246`), and sends Cashfree the server total in rupees (`289-301`).
7. Webhook success is accepted only after HMAC/timestamp validation (`cashfree-webhook.js:54-95`), then currency and amount validation (`229-282`).
8. Only after validation does the webhook set `order.status = 'PAID'` (`284-286`) and send Meta Purchase (`344-361`).
9. The order-status fallback independently queries Cashfree for unpaid orders and marks PAID only when Cashfree says PAID and amount matches (`order-status.js:136-165`), then sends Meta Purchase (`190-207`).

No code path was found where a failed, cancelled, pending, or unpaid order emits server-side Purchase. Failed and dropped statuses are handled separately in `order-status.js:166-172`, `228-252` and `cashfree-webhook.js:410-435`.

One successful order can trigger multiple server transmissions:

- First paid webhook sends Purchase at `cashfree-webhook.js:344-361`.
- Duplicate paid webhook sends Purchase again at `cashfree-webhook.js:197-223`.
- Any `/api/order-status` call for an already PAID order sends Purchase again at `order-status.js:183-207`.

All of those use the same `event_id`, `purchase_${order.id}`, so Meta should deduplicate when events fall within Meta's deduplication window.

## 5. Purchase Value Investigation

Purchase value is not hardcoded in the CAPI sender. It is computed from `order.amount_paise`, `order.total_paise`, or `order.total` in `functions/utils/metaCapi.js:84-89`, using `rupeesFromPaise` at `50-53`.

Cashfree amount is sent in rupees from `pricing.total` (`create-cashfree-order.js:289-292`). The stored order amount is `pricing.totalPaise` (`create-cashfree-order.js:232-245`). Webhook payment amount is converted back to paise with `Math.round(Number(rawPaid) * 100)` and compared to the stored amount (`cashfree-webhook.js:257-282`).

The catalog contains many digital IELTS/OET/PTE/German products priced at ₹199, including fallback/default values in `functions/utils/pricing.js:21-90`. Therefore, if recent purchases were mostly identical digital books, Meta's "same price" warning can be expected.

The earlier `$0.01` lookalike value could not be proven from repository code. Searches found no CAPI Purchase hardcode of `0.01`; the server has a minimum order floor of 100 paise/₹1 in pricing (`functions/utils/pricing.js:1157-1158`), not $0.01. This requires Meta Events Manager history/test-event inspection to determine whether it came from GTM, a test event, currency conversion/reporting, or old code not present here.

## 6. Pixel and CAPI Deduplication

Correct:

- Browser Purchase event ID: `purchase_${orderId}` at `src/utils/analytics.ts:208`.
- Server Purchase event ID: `purchase_${order.id}` at `functions/utils/metaCapi.js:90`.
- Server event name is `Purchase` at `metaCapi.js:116`.
- Browser dataLayer event is `purchase` at `analytics.ts:215`; GTM must map this to Meta `Purchase`.

Risks:

- Server retries are not persisted as "already sent"; duplicate webhooks and order-status refreshes resend the same CAPI event.
- Browser purchase is locally deduped with `localStorage` at `analytics.ts:196-199`, so browser refresh should not resend on the same browser, but a different browser/device can push another browser Purchase if it can view a paid order.
- CAPI webhook events do not receive browser request context, so they cannot include `_fbp`, `_fbc`, client IP, or user agent unless those are stored on the order elsewhere.

## 7. Event Match Quality

Server-side Purchase sends these customer fields:

- `em`, `ph`, `fn`, `ln` hashed via `getNormalizedAndHashedPII` (`metaCapi.js:91-103`; `metaParamBuilder.js:113-117`).
- `fbp`, `fbc`, `client_ip_address`, and `client_user_agent` only when a request is supplied (`metaCapi.js:22-35`, `98-104`).

The middleware captures Meta attribution cookies for normal GET page requests at `functions/_middleware.js:88-89` and appends builder cookies at `metaParamBuilder.js:69-103`. The browser also reads `_fbp` and `_fbc` into purchase dataLayer events at `analytics.ts:96-103`, but GTM behavior must be inspected externally.

Likely explanation from code evidence: Purchase match quality is higher because email/phone/name exist on paid orders. PageView match quality is lower because no server-side PageView exists in this repo and browser PageViews generally have less deterministic customer data. This remains partly inferential without Events Manager diagnostics.

## 8. Security and Privacy

Secrets are environment-driven. `.env.example` documents `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`, `META_CAPI_GRAPH_VERSION`, and `META_TEST_EVENT_CODE` without exposing actual tokens (`.env.example:75-89`). Cashfree credentials are also environment-driven (`create-cashfree-order.js:143-156`; `cashfree-webhook.js:54-57`).

No private token was printed in this audit. Code does log raw Cashfree webhook payloads into order events in several places, including `cashfree-webhook.js:172-176`, `327-330`, `413-417`, and `438-442`. Those payloads may contain customer email/phone/payment metadata and should be treated as sensitive operational data.

There is no explicit consent-management layer in the inspected code. GTM/Meta tags appear to load globally from `index.html`, so consent compliance requires policy/legal validation outside the repository.

## 9. Meta Diagnostics Investigation

Warning 1, same Purchase price: **partially justified but not necessarily a bug**. Code sends dynamic server order value. Identical values are plausible because many advertised digital books are ₹199. Requires checking actual paid order distribution and Events Manager event samples.

Warning 2, low CAPI coverage for PageView: **expected from code**. CAPI implementation only sends Purchase. No PageView server sender was found. This appears to be a browser-only PageView strategy or an incomplete CAPI expansion; it is not evidence of broken Purchase tracking.

Earlier `$0.01` lookalike value: **not reproduced in current repo**. No current server Purchase code sends `0.01`. Requires Meta/GTM historical investigation.

## 10. Critical Issues

### P0

No P0 false-purchase, missing-real-purchase, or severe exposed-secret issue was verified from code inspection.

### P1

- Duplicate server-side Purchase transmissions are possible from duplicate paid webhook and repeated order-status calls: `cashfree-webhook.js:197-223`, `344-361`; `order-status.js:183-207`.
- Browser Meta Pixel implementation is not fully auditable from this repo because GTM container configuration is external. The repository only proves dataLayer events and GTM loading.

### P2

- No CAPI PageView, ViewContent, AddToCart, or InitiateCheckout implementation exists; only Purchase CAPI is implemented.
- Webhook-origin CAPI Purchase lacks browser identifiers and request context.
- AddToCart may be emitted twice for a single click if both view handlers and cart context pushes fire.

### P3

- AddPaymentInfo is not implemented.
- Production/preview separation for Meta dataset is weak in code: `META_PIXEL_ID` defaults to production dataset ID and `META_TEST_EVENT_CODE` is optional.

## 11. Recommended Fixes

1. Persist Meta Purchase send state per order.
   - Files: `functions/api/cashfree-webhook.js`, `functions/api/order-status.js`, likely `functions/utils/db.js`.
   - Change: record a durable `meta_purchase_sent_at` / `meta_purchase_event_id` or query existing `META_CAPI_PURCHASE_SENT` before sending again.
   - Benefit: fewer duplicate CAPI submissions and cleaner diagnostics.
   - Risk: must allow retry after failed sends.

2. Store attribution identifiers at order creation.
   - Files: `functions/api/create-cashfree-order.js`, `functions/utils/metaCapi.js`, schema/migrations.
   - Change: persist `_fbp`, `_fbc`, landing URL, user agent, and IP-derived request metadata safely when order is created, then use it for webhook CAPI.
   - Benefit: improves webhook Purchase match quality.
   - Risk: privacy/retention review needed.

3. Audit GTM container mappings.
   - External: GTM and Meta Events Manager.
   - Confirm `view_item -> ViewContent`, `add_to_cart -> AddToCart`, `begin_checkout -> InitiateCheckout`, and `purchase -> Purchase`, including `event_id`, value, currency, content IDs, and trigger conditions.

4. Keep PageView CAPI optional.
   - Do not add server PageView solely to silence diagnostics. Add only if it improves attribution quality and consent/privacy requirements are satisfied.

## 12. Verification Plan

- In staging, configure a separate Meta test dataset or `META_TEST_EVENT_CODE`; do not use the production dataset.
- Run a Cashfree sandbox purchase for one ₹199 product and one non-₹199/add-on order.
- Verify browser Purchase and server Purchase share `event_id = purchase_<order_id>`.
- Refresh `/order-success` and replay a duplicate webhook in staging; confirm only one durable CAPI send is recorded after the fix.
- Compare Meta Test Events payloads for value, currency INR, content IDs, `num_items`, user data, `_fbp`, `_fbc`, IP, and user agent.
- Confirm failed/cancelled/pending Cashfree returns do not emit Purchase.

## 13. Launch Readiness

**READY WITH WARNINGS**.

The payment-to-Purchase chain is fundamentally safe: Purchase is gated behind server-side paid verification, values are server-authoritative, and currency is INR. The main launch risk is measurement cleanliness, not false purchase inflation: repeated CAPI submissions can occur, and browser Pixel behavior depends on GTM settings that are outside this repository.

## 14. Evidence and Limitations

Verified by code inspection:

- GTM loads globally: `index.html:4-10`, `52-55`.
- No direct `fbq`/`fbevents.js` implementation in repo search.
- CAPI Purchase implementation: `functions/utils/metaCapi.js:74-171`.
- Server-authoritative pricing and Cashfree creation: `functions/api/create-cashfree-order.js:92-127`, `187-246`, `289-301`.
- Paid verification gates: `functions/api/order-status.js:136-165`, `183-207`; `functions/api/cashfree-webhook.js:229-286`, `344-361`.
- Browser dataLayer events: `src/utils/analytics.ts:109-123`, `160-183`, `185-264`.

Verified by automated test:

- `bun run lint` passed (`tsc --noEmit`).
- `bun scripts/test-payment-fulfillment.mjs` passed all 44 payment/fulfillment checks, including paise/rupee consistency and mismatch detection.

Automated test limitation:

- `bun scripts/test-phase12.mjs` stopped at TEST D with `410 !== 403` for a tampered download token. It did not reach later webhook/payment hardening checks in that suite during this audit run.

Requires live validation:

- GTM tag mappings and Meta Pixel browser payloads.
- Meta Events Manager diagnostics, event sample values, deduplication status, and the source of the historical `$0.01` value.
- Cashfree live webhook delivery behavior and production order distribution by price.

Cannot be determined from repository alone:

- Whether the Meta domain is fully verified in Business Manager beyond the static verification meta tag.
- Whether consent/legal requirements are satisfied for all geographies and audiences.
- Whether GTM contains duplicate Meta tags or additional triggers not represented in source control.
