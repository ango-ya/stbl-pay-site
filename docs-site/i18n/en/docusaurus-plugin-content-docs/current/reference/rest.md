---
title: REST API Reference
description: "Overview of the REST API that merchant servers call, with usage notes. Field types, errors, and request examples are in the linked OpenAPI 3.1 specification."
sidebar_label: REST API
sidebar_position: 2
---

# REST API Reference

An overview of the API that your server calls, and notes on using it. You get the endpoint URL from your STBLpay contact when you onboard ([contact](/support/troubleshooting#contact)). Don't assume a public URL or a localhost default.

The type, format, and constraints of each field, the list of errors, and request and response examples are in the OpenAPI 3.1 specification ([view in the browser](pathname:///openapi/), [openapi.yaml](pathname:///openapi.yaml)). Use openapi.yaml for code generation or to give to an AI coding agent.

## Endpoint list

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/payment_intents` | API key (`x-stbl-api-key`) | [Create a payment](#create-payment) |
| `GET` | `/payments/:paymentIntentId` | API key (`x-stbl-api-key`) | [Look up a payment](pathname:///openapi/#operation/getPayment) (In preparation for release; until then, use the [status check](/server/retrieve-payment)) |
| `GET` | `/payment_status/:paymentIntentId` | None | Checkout-page status |
| `GET` | `/payment_intents/:paymentIntentId` | None | Checkout-page display information |
| `GET` | `/payment_intents/{paymentIntentId}/refundable` | Refund API key + HTTP signature | [Check the refundable amount](pathname:///openapi/#operation/getMachineRefundable) (In preparation for release) |
| `POST` | `/payment_intents/{paymentIntentId}/refunds/prepare` | Refund API key + HTTP signature | [Prepare a refund](pathname:///openapi/#operation/prepareMachineRefund) (In preparation for release) |
| `POST` | `/payment_intents/{paymentIntentId}/refunds/submit` | Refund API key + HTTP signature | [Sign and submit a refund](pathname:///openapi/#operation/submitMachineRefund) (In preparation for release) |
| `GET` | `/refunds/{refundId}` | Refund API key + HTTP signature | [Look up a refund](pathname:///openapi/#operation/getMachineRefund) (In preparation for release) |
| `GET` | `/payment_intents/{paymentIntentId}/refunds` | Refund API key + HTTP signature | [List refunds for a payment](pathname:///openapi/#operation/listMachinePaymentRefunds) (In preparation for release) |
| `DELETE` | `/staged_operations/{stagedOpId}` | Refund API key + HTTP signature | [Discard a preparation](pathname:///openapi/#operation/discardMachineStagedOperation) (In preparation for release) |

Request and response bodies are JSON, and the fields are camelCase.

## Create payment {/* #create-payment */}

`POST /payment_intents` creates a payment and returns the `checkoutUrl` that you send the buyer to. The fields, errors, and examples are in ["Create a payment" in the OpenAPI specification](pathname:///openapi/#operation/createPaymentIntent).

- Amounts (such as `amountJpy`) are decimal strings, not JSON numbers (example: `"4980"`). Handle fractions such as fees without converting them to floating-point numbers. `amountJpy` must be greater than 0 (`"0"` or a negative value returns 400 `common/invalid_request`). Beyond that, the API imposes no upper or lower limit on the amount. For operational limits, check with your [contact](/support/troubleshooting#contact).
- `orderId` is an ID for each payment attempt and the idempotency key. Calling again from the same store with the same value returns the existing payment. Use the same value when you resend the request, and a new value when the buyer pays again after `failed`, `expired`, or `canceled`. With multiple stores, assign values that are unique across the whole merchant ([constraint across stores](/server/create-payment#idempotency)).
- Specify `returnUrl` as an `https://` URL. Its hostname does not need to match the domain registered in the merchant console ([requirements](/security/domain#returnurl-requirements)). When a payment reaches a terminal state, the checkout page shows a link back: "Back to the shop" (ショップに戻る) if the payment succeeded, or "Back to the payee" (お支払い先に戻る) in any other terminal state. When the buyer clicks it, `returnUrl` opens with a `stbl_pay_intent` query parameter (the payment ID) appended. If `returnUrl` already has a query parameter with the same name, it is overwritten.
- `merchantExpiresAt` is the upper limit of the deposit deadline ([How deadlines work](/lifecycle/transitions)).
- Even if the response `status` is `created`, the payment has not succeeded. Confirm success with a Webhook or a status lookup.
- `feeJpy` and `netAmountJpy` in the response are estimates. Record the deposit using `net_received_jpy` in `payment.settled` ([How amounts are handled](/reference/webhook-events#amounts)).

## Retrieve payment status {/* #retrieve-payment */}

Call `GET /payments/:paymentIntentId` from your server with the store API key in `x-stbl-api-key`. See the [OpenAPI specification](pathname:///openapi/#operation/getPayment) and [implementation example](/server/retrieve-payment). There is no request body.

**This API is being prepared for release and is not yet deployed to Sandbox (as of November 17, 2026).** Until it is deployed, check the status with the unauthenticated `GET /payment_status/:paymentIntentId`.

All twelve keys are required: `paymentIntentId`, `orderId`, `status`, `amountJpy`, `feeJpy`, `netAmountJpy`, `txHash`, `settledAt`, `failedReason`, `payerAddress`, `netAmountDestination`, and `createdAt`. `orderId`, `txHash`, `settledAt`, `failedReason`, `payerAddress`, and `netAmountDestination` can be null. Ignore unknown keys.

- Only the authenticated store's payments are returned. Another store, another merchant, and an unknown ID all return the same 404. Valid keys work during merchant suspension or store disablement; revoked keys are rejected.
- `payerAddress` is the payer wallet address, not an identity verification result. `netAmountDestination` is the destination recorded for the merchant's proceeds when the payment settled. Missing records in older payments are not backfilled and remain null. Both are null for non-`settled` payments.
- For `settled`, `feeJpy` and `netAmountJpy` contain actual amounts, or estimates if execution details are unavailable. Other statuses return estimates, unlike the `"0"` amounts in non-settled Webhooks.
- The default is 600 requests per API key per UTC calendar minute. For 429 `common/rate_limited`, wait for the integer seconds in `Retry-After`. Failure to check the limit returns 503 `common/service_unavailable`. Send unknown error codes to a common fallback.

The existing `GET /payment_status/:paymentIntentId` and `GET /payment_intents/:paymentIntentId` are unauthenticated checkout-page endpoints. The status response has no amounts, fees, or wallets. A payment ID does not authorize viewing your own orders.

## Status values {/* #status-values */}

Only `settled` means the payment succeeded. Base delivery of goods and recording of revenue on this status. The categories, meanings, and transitions of the values are in the [status list](/lifecycle/statuses). The list of values is also under `status` in the [OpenAPI specification](pathname:///openapi/#operation/getPaymentStatus).

If you receive an unknown value, do not deliver goods or charge again; treat it as under review.

## `failed_reason` classification codes {/* #failed-reason-codes */}

`failedReason` (status lookup) and the Webhook `failed_reason` contain a failure classification code. The list of codes and their meanings is under `failedReason` in the [OpenAPI specification](pathname:///openapi/#operation/getPaymentStatus).

Codes may be added in the future, but the meaning of an existing code does not change. Receivers should not validate the value strictly as an enumeration; **fall back to treating an unknown value as a failure.** The following codes are handled differently from the rest.

- `nonce_conflict`: The outcome has not been determined. Do not close the order as failed; hold it and [refer it for investigation](/lifecycle/edge-cases#nonce-conflict). No Webhook is delivered; it is visible only through a status lookup.
- `userop_expired`: The payment is `failed`, but **the money has arrived.** This is a different event from `expired` (no deposit within the deadline). The buyer's JPYC balance has not decreased and can be used for the next payment.
- `merchant_wallet_outdated`: You must run "Update" (アップデート) for the receiving wallet in the merchant console.
- `merchant_suspended`: A payment moved to a terminal state because of a merchant suspension ([Merchant suspension](/lifecycle/edge-cases#merchant-suspension)).

For every code except `nonce_conflict`, the payment ends as `failed` and has not succeeded.

## Errors {/* #errors */}

The error body is `{ code, details? }`. The error codes and what to do for each endpoint are in the responses of each endpoint in the [OpenAPI specification](pathname:///openapi/).

```json
{ "code": "common/invalid_request" }
```

- Branch on `code`, and use the HTTP status only as a supplement. **Fall back to your common error handling for unknown codes.** Codes may be added.
- The server does not return display text, so you decide the text to display.
- When a 429 is returned, retry after a pause, regardless of the body's shape. When the network layer in front applies rate limiting, the body does not contain a `code`.
- Retrying `common/internal` (500) with the same `orderId` does not create the payment twice.
- `payment/order_id_conflict` (409) is returned when you create a payment with an `orderId` already used at a different store of the same merchant. Retrying with the same value does not resolve it, so create the payment again with a new `orderId` ([constraint across stores](/server/create-payment#idempotency)).

Refunds use separate authority from payment processing. The owner console flow and draft [merchant server API](/refunds/machine-api) are described in [refund scope](/refunds/overview). The draft does not announce production availability.

## Amounts, chains, and tokens {/* #amounts-chains-tokens */}

Amounts are decimal strings denominated in yen, including fractions (for example, `"4980.125"`). JPYC base units equal yen × 10^18; the existing API Jpy conversion precision is six decimal places. Token decimals and API conversion precision are different. Do not convert amounts to floating-point numbers. One tx can contain multiple payments and Transfer events, so match orders by the saved paymentIntentId rather than txHash alone.

| Environment | chainId | JPYC contract address |
|---|---|---|
| Sandbox | Deployment configuration verification pending (unavailable) | Unavailable; confirm with your onboarding contact |
| Production | Unavailable | Unavailable |

The running Sandbox API's chainId/stablecoin pair has not been verified. Do not use the existing development Amoy values (80002 / `0xe7c3d8c9a439fede00d2600032d5db0be71c3c29`) as Sandbox settings. Production runtime settings have also not been verified, so no unverified address is published.
