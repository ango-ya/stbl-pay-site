---
title: Webhook Event Reference
sidebar_label: Webhook events
sidebar_position: 3
---

# Webhook Event Reference

While the regular REST API uses camelCase, the **Webhook payload uses snake_case**.

The definition of each field in the Webhook body and headers is in `webhooks` in the OpenAPI 3.1 specification [openapi.yaml](pathname:///openapi.yaml). This page gives an overview and usage notes.

## Common format

For the definition of each field, see `webhooks.paymentEvent` (`WebhookEvent`) in the [OpenAPI specification](pathname:///openapi.yaml).

The body has `id` (the event ID, starting with `evt_`), `type`, `created_at` (ISO 8601 ending in UTC `Z`), and `data`. `created_at` is the time the event was generated, and differs from the send time `t` in the signature header.

| Header | Content |
|---|---|
| `Stbl-Pay-Signature` | `t=<Unix seconds>,v1=<HMAC-SHA256 hex>`. During a key migration period there are multiple `v1` values |
| `Stbl-Pay-Event-Id` | A copy of the body's `id`. Unchanged on resends |

Use the **`id` of the signature-verified body** for deduplication. The event ID in the header is not covered by the signature.

## Events and data

For the definition of each field, see `WebhookPaymentData` in the [OpenAPI specification](pathname:///openapi.yaml).

The four types `payment.settled`, `payment.failed`, `payment.canceled`, and `payment.expired` use a common `data` shape. Even in `payment.failed`, common fields such as the amount are not omitted.

| Field | Reference and notes |
|---|---|
| `payment_intent_id` / `order_id` | Correspondence to your order. `payment_intent_id` is an ID starting with `pi_`. `order_id` is the `orderId` you passed when creating the payment, and is null if you did not pass one |
| `status` | The terminal status corresponding to the event |
| `merchant_id` / `payout` | The merchant (an ID starting with `m_`) and the payout destination (a 20-byte address with a lowercase `0x` prefix) |
| `amount_jpy` / `fee_jpy` / `net_received_jpy` | All are JPY-denominated strings. Do not carelessly convert them to a numeric type. For the value per event, see [How amounts are handled](#amounts) |
| `tx_hash` / `settled_at` | Nullable. `tx_hash` is a 32-byte value with a lowercase `0x` prefix, and `settled_at` is ISO 8601 ending in UTC `Z`. For canceled and expired events both are null, and the keys are not omitted |
| `failed_reason` | A nullable string. The value is one of the currently defined [classification codes](/reference/rest#failed-reason-codes). Codes may be added, so receivers should not reject the Webhook on an unknown value; fall back to treating it as a failure. The reasons behind the issuer's decision on whether to allow a transaction are not included |

## How amounts are handled {/* #amounts */}

`amount_jpy` is the order amount, and stays the order amount in every event. `fee_jpy` and `net_received_jpy` vary by event as follows.

| Event | `amount_jpy` | `fee_jpy` / `net_received_jpy` |
|---|---|---|
| `payment.settled` | Order amount | The fee actually deducted on-chain and the amount the merchant receives (actual amounts) |
| `payment.failed` / `payment.canceled` / `payment.expired` | Order amount | Both are `"0"` |

The actual amounts in `payment.settled` are taken from the result of executing the payment. Only when the fee cannot be obtained from the execution result is a value calculated from the estimate made at payment creation used instead. For that reason, `fee_jpy` in `payment.settled` may differ from `feeJpy` in the creation response. Use `net_received_jpy` in `payment.settled` to record the deposit.

Notifications for failure, cancellation, and expiry mean no funds moved, so `fee_jpy` and `net_received_jpy` are `"0"`. Even though `amount_jpy` still holds the order amount, it does not mean that a deposit to the merchant succeeded. Base your deposit recording on `payment.settled` or on `settled` from a server-to-server lookup.

## Delivery and handling

The send timeout, the responses treated as failures, and the retry intervals are also in `webhooks.paymentEvent` in the [OpenAPI specification](pathname:///openapi.yaml).

A successful receipt is a `2xx`. Implement [signature verification](/webhooks/signature), the [retry policy](/webhooks/retry), and [idempotency](/webhooks/idempotency). Make sure unknown types can be safely ignored.

There is no notification for `nonce_conflict`. Confirm it with the status lookup API and operational investigation.

## Test notifications {/* #test-notifications */}

For the definition of each field, see `TestWebhookEvent` in the [OpenAPI specification](pathname:///openapi.yaml).

Only the test notification sent from the merchant console keeps `type` as `payment.settled` and carries `test: true` in the body. Regular notifications have no `test` key. The values of each field are as follows.

| Field | Value in a test notification |
|---|---|
| `id` | Starts with `evt_test_` |
| `type` | `payment.settled` |
| `created_at` | The time it was sent |
| `test` | `true` |
| `data.payment_intent_id` | Starts with `pi_test_`. Does not point to a real payment |
| `data.order_id` | Starts with `test_`. Does not point to a real order |
| `data.status` | `settled` |
| `data.merchant_id` | Your own merchant ID |
| `data.payout` | The address of your registered payout destination |
| `data.amount_jpy` / `data.net_received_jpy` | `"1000"` |
| `data.fee_jpy` | `"0"` |
| `data.settled_at` | The time it was sent |
| `data.tx_hash` / `data.failed_reason` | `null` |

For the procedure on the receiving side, see [Receiving test notifications](/webhooks/events#test-notifications).
