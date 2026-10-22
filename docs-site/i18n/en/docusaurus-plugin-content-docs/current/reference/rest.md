---
title: REST API Reference
sidebar_label: REST API
sidebar_position: 2
---

# REST API Reference

This page lists the methods, paths, authentication, fields, and errors of the API that your server calls. You get the endpoint URL from your STBLpay contact when you onboard ([contact](/support/troubleshooting#contact)). Don't assume a public URL or a localhost default.

## Endpoint list

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/payment_intents` | API key (`x-stbl-api-key`) | [Create a payment](#create-payment) |
| `GET` | `/payment_status/:paymentIntentId` | None | [Retrieve payment status](#retrieve-payment) |

Request and response bodies are JSON.

## Create payment {/* #create-payment */}

`POST /payment_intents`

Creates a payment and returns the `checkoutUrl` that you send the buyer to.

### Request headers

| Header | Required | Value |
|---|---|---|
| `x-stbl-api-key` | Required | The API key issued in the merchant console |
| `Content-Type` | Required | `application/json` |

### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `amountJpy` | Amount string | Required | Amount to charge (JPY) |
| `orderId` | String (up to 128 characters) | Optional | Your own order ID. The idempotency key |
| `returnUrl` | HTTPS URL string | Optional | URL the buyer returns to after payment |
| `merchantExpiresAt` | Datetime string | Optional | Upper limit of the deposit deadline |

### Field notes {/* #field-notes */}

- `amountJpy` is a string representing a decimal number: an integer part with no leading zeros, plus an optional fractional part (examples: `"4980"`, `"0.5"`). It is not a JSON number. Handle fractions such as fees without converting them to floating-point numbers.
  - `"0"` is not accepted. Specify an amount greater than 0 (400 `common/invalid_request`).
  - The fractional part is limited to 6 digits. More than that returns 400 `common/invalid_request`.
  - This API does not impose its own upper or lower limit on the amount. At payment time, the payment may not succeed because it hits the amount limit or frequency limit of the buyer's wallet (`failed_reason` is `policy_violation`). For operational upper and lower limits, check with your [contact](/support/troubleshooting#contact).
- If you create a payment again from the same store with the same `orderId`, the existing payment is returned. Specify a stable value for each order. If you omit it, idempotency by this order identifier is not available. With multiple stores, assign values that are unique across the whole merchant ([constraint across stores](/server/create-payment#idempotency)).
- `returnUrl` must satisfy all of the following conditions. If it does not, the payment is not created. A URL that is not `https` returns 400 `common/invalid_request`. However, `http://localhost`, `http://127.0.0.1`, and `http://[::1]` pass the format check, so they return 403 `merchant/origin_mismatch`. An `https` URL that fails the other conditions also returns 403 `merchant/origin_mismatch`.
  - The scheme is `https`. `http` cannot be used. Development URLs such as `http://localhost` cannot be used either (403 `merchant/origin_mismatch`).
  - A port number cannot be included (`https://shop.example.com:8443/` is not allowed).
  - userinfo such as `user:pass@` cannot be included.
  - The hostname **exactly matches** a domain registered in the merchant console (case-insensitive). Subdomains are treated as different domains, so if you registered `shop.example.com`, `www.shop.example.com` cannot be used. For domain registration, see [Domain registration](/security/domain).
  - There are no restrictions on the path and query (example: `https://shop.example.com/orders/ord_0001/return`).

  When a payment reaches a terminal state, the checkout page shows a link back: "Back to the shop" (ショップに戻る) if the payment succeeded, or "Back to the payee" (お支払い先に戻る) in any other terminal state. When the buyer clicks it, `returnUrl` opens with a `stbl_pay_intent` query parameter appended (example: `https://shop.example.com/orders/ord_0001/return?stbl_pay_intent=pi_xxx`). The value is the payment ID. If `returnUrl` already has a query parameter with the same name, it is overwritten.
- `merchantExpiresAt` is used as the upper limit of the deposit deadline (which is determined when the buyer proceeds to the JPYC EX procedure). It does not shorten the operation deadline (`checkoutExpiresAt`). You can only specify a datetime more than 3 days after creation. Only the form ending in UTC `Z` is accepted (example: `"2026-10-20T03:00:00Z"`). A value with an offset such as `+09:00` returns 400 `common/invalid_request`. Even if you create again with the same `orderId`, the value received first is not overwritten. See [How deadlines work](/lifecycle/transitions).

### Response

On success, the API returns 201 with the following JSON. It also returns 201 when it returns an existing payment for the same `orderId`.

| Field | Type | Description |
|---|---|---|
| `paymentIntentId` | Payment ID string | The payment ID. Store it linked to your order |
| `checkoutUrl` | HTTPS URL string | URL of the checkout page to send the buyer to with a top-level navigation |
| `status` | [Status values](#status-values) | `created` when newly created |
| `amountJpy` | Amount string | Amount charged |
| `feeJpy` | Amount string | Fee |
| `netAmountJpy` | Amount string | Amount the merchant receives (`amountJpy` − `feeJpy`) |
| `checkoutExpiresAt` | Datetime string | Deadline of the checkout page |
| `createdAt` | Datetime string | When the payment was created |

Even if `status` is `created`, the payment has not succeeded. Confirm success with a Webhook or a status lookup.

### Main errors

`merchant/origin_mismatch`, `merchant/domain_required`, `merchant/suspended`, `store/disabled`, `payment/order_terminated`, `payment/expires_at_too_soon`, `auth/api_key_invalid`, `common/invalid_request`, `common/internal`. See [Errors](#errors) for their meanings and what to do.

### Example

Request:

```http
POST /payment_intents
x-stbl-api-key: stblpay_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "amountJpy": "4980",
  "orderId": "ord_0001",
  "returnUrl": "https://shop.example.com/orders/ord_0001/return"
}
```

Response (values are examples):

```json
{
  "paymentIntentId": "pi_0123456789abcdef",
  "checkoutUrl": "https://checkout.example/checkout/pi_0123456789abcdef",
  "status": "created",
  "amountJpy": "4980",
  "feeJpy": "49.8",
  "netAmountJpy": "4930.2",
  "checkoutExpiresAt": "2026-10-20T03:00:00.000Z",
  "createdAt": "2026-10-19T03:00:00.000Z"
}
```

## Retrieve payment status {/* #retrieve-payment */}

`GET /payment_status/:paymentIntentId`

Returns the current status of a payment. **There is no authentication.** No API key or Authorization header is needed.

### Path parameters

| Parameter | Type | Description |
|---|---|---|
| `paymentIntentId` | Payment ID string | The `paymentIntentId` you received when creating the payment |

### Response

On success, the API returns 200 with the following JSON.

| Field | Type | Description |
|---|---|---|
| `paymentIntentId` | Payment ID string | The payment ID you looked up |
| `status` | [Status values](#status-values) | Current status |
| `txHash` | String of `0x` plus 64 hex digits, or null | The transaction of the transfer |
| `failedReason` | String, or null | The [classification code](#failed-reason-codes) of the failure |
| `returnUrl` | HTTPS URL string, or null | The `returnUrl` specified at creation |
| `settledAt` | Datetime string, or null | When the payment succeeded. null unless `settled` |

This response does not include the amount, fee, or wallet. The payment ID is not a secret, and it cannot replace access control for your own orders.

### Main errors

`payment/not_found` (404, the payment ID does not exist), `common/invalid_request` (400, the [format](#value-formats) of the payment ID is wrong). See [Errors](#errors) for their meanings and what to do.

### Example

```http
GET /payment_status/pi_0123456789abcdef
```

```json
{
  "paymentIntentId": "pi_0123456789abcdef",
  "status": "settled",
  "txHash": "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "failedReason": null,
  "returnUrl": "https://shop.example.com/orders/ord_0001/return",
  "settledAt": "2026-10-19T03:05:00.000Z"
}
```

## Status values {/* #status-values */}

`status` is one of the following. Only `settled` means the payment succeeded. Base delivery of goods and recording of revenue on this status. For the meaning of the categories and the transitions, see the [status list](/lifecycle/statuses).

| Value | Category | Short meaning |
|---|---|---|
| `created` | In progress | The payment was created. Waiting for the signature |
| `signed` | In progress | The buyer's signature is done |
| `issue_pending` | In progress | The buyer proceeded to the JPYC EX procedure. This does not mean the procedure is finished |
| `deposit_confirmed` | In progress | The deposit (or balance) was confirmed. Before the payment is executed |
| `deploying` | In progress | The buyer's wallet is being created |
| `executing` | In progress | Execution of the payment has started. The result is being confirmed |
| `settled` | Succeeded | The payment succeeded and the funds were sent to the merchant |
| `canceled` | Did not succeed | The payment was canceled |
| `expired` | Did not succeed | Ended because the deadline passed (not approved, or the amount was not complete by the deposit deadline) |
| `failed` | Did not succeed | The payment failed. The reason is in `failedReason` |
| `nonce_conflict` | Needs review | The outcome could not be determined. Do not treat it as either succeeded or failed |

If you receive an unknown value, do not deliver goods or charge again; treat it as under review. The API schema also defines a value `deposit_seen`, but it is not returned now.

## Value formats {/* #value-formats */}

| Value | Format | Example |
|---|---|---|
| Payment ID (`paymentIntentId`) | `pi_` followed by 8 to 32 lowercase hex digits | `pi_0123456789abcdef` |
| Event ID (Webhook `id`) | `evt_` followed by 8 to 32 lowercase hex digits | `evt_0123456789abcdef` |
| `txHash` | `0x` followed by 64 lowercase hex digits | `0x` + 64 digits |
| API key | `stblpay_` followed by 43 characters of alphanumerics, `-`, and `_` | `stblpay_` + 43 characters |
| Datetime | ISO 8601 ending in UTC `Z`. Responses include milliseconds. Requests may omit milliseconds | `2026-10-20T03:00:00.000Z` |
| Amount (`amountJpy`, etc.) | Decimal number string. No leading zeros; the fractional part is optional | `"4980"` |

The IDs in a [test notification](/reference/webhook-events#test-notifications) are `evt_test_` and `pi_test_` followed by 24 lowercase hex digits, which do not match the formats above.

## `failed_reason` classification codes {/* #failed-reason-codes */}

The value in `failedReason` (status lookup) and in the Webhook `failed_reason` is one of the codes in the following table. Raw chain error strings are not included. Codes may be added in the future. Receivers should not validate the value strictly as an enumeration; **fall back to treating an unknown value as a failure.** The reasons behind the issuer's decision on whether to allow a transaction are not included.

| Code | Meaning |
|---|---|
| `userop_expired` | The deposit or sufficient balance was confirmed, but the time at which the payment could be executed had passed. **The money has arrived.** This is a different event from `expired` (no deposit within the deadline), and it is delivered as `payment.failed`. The buyer's JPYC balance has not decreased and can be used for the next payment |
| `deposit_recipient_mismatch` | The recipient of the deposit differs from the recipient expected for the payment |
| `wallet_deploy_failed` | Creating the buyer's wallet failed (an execution failure, or the attempt limit was reached) |
| `missing_signed_userop` | The signed operation required for execution was missing |
| `insufficient_balance` | The payer's balance is insufficient |
| `policy_violation` | The payer's wallet hit its amount limit or frequency limit |
| `not_pay_call` / `not_allowed_call` | The payment operation was not in an allowed form |
| `fee_amount_mismatch` | The fee amount does not match |
| `fee_not_collected` | The fee was not collected |
| `merchant_wallet_outdated` | The implementation of the merchant's receiving wallet is outdated and the grace period has passed. You must run "Update" (アップデート) in the merchant console |
| `unexpected_implementation` | The wallet implementation differs from what was expected |
| `userop_reverted` | A failure of the payment operation that matches none of the above |
| `nonce_conflict` | The outcome could not be determined (the status is also `nonce_conflict`). **No Webhook is delivered; it is visible only through a status lookup.** [Referred for investigation](/lifecycle/edge-cases) |
| `merchant_suspended` | Because of a merchant suspension, a payment whose sending had not started was moved to a terminal state. JPYC already deposited remains in the buyer's wallet. [Merchant suspension](/lifecycle/edge-cases#merchant-suspension) |
| `unclassified` | A failure that has not been classified yet |

With any code except `nonce_conflict`, the payment ends as `failed` and has not succeeded. Close the order as failed, then use the code to decide what to investigate and what to tell the buyer. For `nonce_conflict`, the outcome is not yet determined: do not close the order as failed, and hold it until a status lookup confirms the result. The meaning of a code does not change, and codes may be added.

## Errors {/* #errors */}

The server's error format is `{ code, details? }`. For example:

```json
{ "code": "common/invalid_request" }
```

The codes related to merchant settings and suspension are as follows.

| `code` | HTTP | Meaning and what to do |
|---|---|---|
| `merchant/domain_required` | 409 | A domain must be registered for EC payments. Register it in the merchant console ([Domain registration](/security/domain)) |
| `merchant/suspended` | 403 | The merchant is suspended. Payments cannot be created. Wait for reinstatement |
| `merchant/origin_mismatch` | 403 | `returnUrl` does not meet the registered-domain conditions. Use a URL that satisfies the [`returnUrl` conditions](#field-notes) |
| `payment/order_terminated` | 409 | The existing payment for the same `orderId` was already canceled by a suspension, or was created before the suspension and has not been sent yet. `details` is `{ paymentIntentId, status, failedReason }`. Create again with a new `orderId` |

See [Merchant suspension](/lifecycle/edge-cases#merchant-suspension).

The errors that `POST /payment_intents` can return are as follows (excluding those in the table above).

| `code` | HTTP | Meaning and what to do |
|---|---|---|
| `auth/api_key_invalid` | 401 | The API key is invalid, revoked, or was not sent. Check the key |
| `store/disabled` | 409 | The store is disabled. Check the store's status in the merchant console |
| `payment/expires_at_too_soon` | 400 | `merchantExpiresAt` is too soon (it would expire within 3 days of creation). See [How deadlines work](/lifecycle/transitions) and specify a later time |
| `common/invalid_request` | 400 | The request format is invalid (a field type or format violation). Fix the input. `details.issues` holds an array with one entry per violation (`path` of each entry is the field, `message` is the reason) |
| `common/internal` | 500 | A server-side failure. Retrying with the same `orderId` does not create the payment twice. However, specifying an `orderId` used at a different store also returns this error, and retrying does not resolve that case ([constraint across stores](/server/create-payment#idempotency)) |

The status lookup (`GET /payment_status/:paymentIntentId`) returns `payment/not_found` (404) for a payment ID that does not exist. If the payment ID does not match the format (`pi_` followed by 8 to 32 lowercase hex digits), it returns `common/invalid_request` (400) before checking whether the payment exists.

When a 429 is returned, retry after a pause, regardless of the body's shape. Payment creation and status lookup have no application-level rate limit. However, rate limiting may be applied by the network layer in front, and in that case the body does not contain a `code`.

Branch on `code`, and use the HTTP status only as a supplement. **Fall back to your common error handling for unknown codes.** Codes may be added. `details` is optional structured information. You decide the text to display.

Refunds are a merchant console feature, and there is no refund API that the merchant server can call ([scope of refunds](/refunds/overview)).
