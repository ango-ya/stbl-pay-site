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
| `GET` | `/payment_status/:paymentIntentId` | None | [Retrieve payment status](#retrieve-payment) |

Request and response bodies are JSON, and the fields are camelCase.

## Create payment {/* #create-payment */}

`POST /payment_intents` creates a payment and returns the `checkoutUrl` that you send the buyer to. The fields, errors, and examples are in ["Create a payment" in the OpenAPI specification](pathname:///openapi/#operation/createPaymentIntent).

- Amounts (such as `amountJpy`) are decimal strings, not JSON numbers (example: `"4980"`). Handle fractions such as fees without converting them to floating-point numbers. `amountJpy` must be greater than 0 (`"0"` or a negative value returns 400 `common/invalid_request`). Beyond that, the API imposes no upper or lower limit on the amount. For operational limits, check with your [contact](/support/troubleshooting#contact).
- `orderId` is an ID for each payment attempt and the idempotency key. Calling again from the same store with the same value returns the existing payment. Use the same value when you resend the request, and a new value when the buyer pays again after `failed`, `expired`, or `canceled`. With multiple stores, assign values that are unique across the whole merchant ([constraint across stores](/server/create-payment#idempotency)).
- The hostname of `returnUrl` must exactly match a domain registered in the merchant console ([Domain registration](/security/domain)). When a payment reaches a terminal state, the checkout page shows a link back: "Back to the shop" (ショップに戻る) if the payment succeeded, or "Back to the payee" (お支払い先に戻る) in any other terminal state. When the buyer clicks it, `returnUrl` opens with a `stbl_pay_intent` query parameter (the payment ID) appended. If `returnUrl` already has a query parameter with the same name, it is overwritten.
- `merchantExpiresAt` is the upper limit of the deposit deadline ([How deadlines work](/lifecycle/transitions)).
- Even if the response `status` is `created`, the payment has not succeeded. Confirm success with a Webhook or a status lookup.
- `feeJpy` and `netAmountJpy` in the response are estimates. Record the deposit using `net_received_jpy` in `payment.settled` ([How amounts are handled](/reference/webhook-events#amounts)).

## Retrieve payment status {/* #retrieve-payment */}

`GET /payment_status/:paymentIntentId` returns the current status of a payment. The fields, errors, and examples are in ["Retrieve payment status" in the OpenAPI specification](pathname:///openapi/#operation/getPaymentStatus).

- **There is no authentication.** No API key or Authorization header is needed.
- A payment ID is not a secret. Do not use it in place of permission to view your own orders.
- This response does not include amounts, fees, or wallets.

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

Refunds are a merchant console feature, and there is no refund API that the merchant server can call ([scope of refunds](/refunds/overview)).
