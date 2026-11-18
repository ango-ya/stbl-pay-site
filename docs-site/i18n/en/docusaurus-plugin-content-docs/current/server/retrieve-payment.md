---
title: Retrieve payment status
description: "How a merchant server checks the current state of a payment by its saved payment intent ID. Use a store API key to back up Webhooks."
sidebar_label: Retrieve payment status
sidebar_position: 3
---

# Retrieve payment status

From the merchant server, [look up](/reference/glossary) the current status using the saved `paymentIntentId`. Send the store API key in the `x-stbl-api-key` header.

**This API is being prepared for release and is not yet deployed to Sandbox (as of November 17, 2026).** You cannot call it until it is deployed. Ask your [contact](/support/troubleshooting#contact) about the timing. Until then, you can check the status with the unauthenticated `GET /payment_status/:paymentIntentId`. That response returns the status and does not include amounts, fees, or addresses.

```js
const response = await fetch(
  `${process.env.STBL_PAY_BACKEND}/payments/${encodeURIComponent(paymentIntentId)}`,
  { headers: { "x-stbl-api-key": process.env.STBL_PAY_API_KEY } },
);
if (!response.ok) throw new Error(`Status lookup failed: HTTP ${response.status}`);
const payment = await response.json();
```

Your own order display API needs login and an order ownership check. Use the ID saved on the order, not an arbitrary payment ID passed by the browser.

## Handling the response

The response fields are summarized in the [REST reference](/reference/rest#retrieve-payment). For the definition of each field, see the 200 response of `GET /payments/{paymentIntentId}` in the [OpenAPI specification](pathname:///openapi/#operation/getPayment). The response contains twelve fields, including amounts, fees, and addresses. Do not treat a lookup failure or timeout as a `failed` payment.

| Status | Order-side handling |
|---|---|
| `settled` | Confirm the match with the order, and mark it as paid exactly once |
| `canceled` / `expired` / `failed` | End the order that has not been fulfilled, following your business rules |
| `nonce_conflict` | The outcome cannot be determined, so stop automatic shipping and automatic re-billing, and ask the [contact](/support/troubleshooting#contact) to investigate with the payment ID |
| The other 6 statuses | The payment is in progress; continue looking it up |

Use this for a confirming lookup when you receive a Webhook, and for periodic reconciliation of unconfirmed orders whose notification you missed. Keep checking even if the browser does not return.

See also [Completion criteria](/lifecycle/completion) and [Meaning of statuses](/lifecycle/statuses).

## Lookup boundaries {/* #lookup-boundaries */}

Retrieve one payment belonging to the authenticated store. Another store, another merchant, and an unknown ID all return 404 `common/not_found`. There is no list or `orderId` lookup API. Valid keys remain usable during merchant suspension or store disablement; revoked keys return 401 `auth/api_key_invalid`.

The default limit is 600 requests per API key per UTC calendar minute, shared by all API tasks. Requests returning 404 or invalid IDs also count. Up to 1200 requests can pass in a short interval across a minute boundary. For 429 `common/rate_limited`, wait for the integer seconds in `Retry-After`. Failure to check the limit returns 503 `common/service_unavailable`. Keep the order pending on lookup errors and retry after a delay.

`payerAddress` and `netAmountDestination` have values only for `settled` payments with recorded evidence. Older payments are not backfilled and remain null. The former is the payer wallet address, not an identity verification result. The latter is the destination recorded for the merchant's proceeds when that payment settled; current settings never fill missing values. Lookup is read-only. Existing refund features remain available (see [refund availability](/refunds/overview)).

For `settled`, `feeJpy` and `netAmountJpy` contain actual amounts, or creation estimates if execution details are unavailable, including older records. For other statuses they contain estimates, unlike the `"0"` amounts in non-settled Webhooks. Ignore unknown response keys.
