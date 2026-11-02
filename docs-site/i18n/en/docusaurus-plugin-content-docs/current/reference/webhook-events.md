---
title: Webhook Event Reference
sidebar_label: Webhook events
sidebar_position: 3
---

# Webhook Event Reference

While the regular REST API uses camelCase, the **Webhook payload uses snake_case**.

The definition of each field in the Webhook body and headers is in `webhooks` in the OpenAPI 3.1 specification ([view in the browser](pathname:///openapi/#operation/receivePaymentEvent), [openapi.yaml](pathname:///openapi.yaml)). This page gives an overview and usage notes.

## Common format

The body has `id` (the event ID), `type`, `created_at`, and `data`. The signature is in the `Stbl-Pay-Signature` header. The header and body fields are in ["Receive the payment result" in the OpenAPI specification](pathname:///openapi/#operation/receivePaymentEvent).

- Use the **`id` of the signature-verified body** for deduplication. The `Stbl-Pay-Event-Id` header is not covered by the signature.
- `created_at` is the time the event was created, and differs from the send time `t` in the signature header.

## Events and data

The four types `payment.settled`, `payment.failed`, `payment.canceled`, and `payment.expired` use a common `data` shape. Even in `payment.failed`, common fields such as the amount are not omitted. For canceled and expired events, `tx_hash` and `settled_at` are null, and the keys are not omitted.

- `order_id` is the `orderId` you passed when creating the payment. It is null if you did not pass one.
- Amounts are JPY-denominated strings. Do not carelessly convert them to a numeric type. The value per event is in [How amounts are handled](#amounts).
- The value of `failed_reason` is one of the [classification codes](/reference/rest#failed-reason-codes). Do not reject the Webhook on an unknown value; fall back to treating it as a failure.

## How amounts are handled {/* #amounts */}

`amount_jpy` is the order amount, and stays the order amount in every event. `fee_jpy` and `net_received_jpy` vary by event as follows.

| Event | `amount_jpy` | `fee_jpy` / `net_received_jpy` |
|---|---|---|
| `payment.settled` | Order amount | The fee actually deducted on-chain and the amount the merchant receives (actual amounts) |
| `payment.failed` / `payment.canceled` / `payment.expired` | Order amount | Both are `"0"` |

The actual amounts in `payment.settled` are taken from the result of executing the payment. Only when the fee cannot be obtained from the execution result is a value calculated from the estimate made at payment creation used instead. For that reason, `fee_jpy` in `payment.settled` may differ from `feeJpy` in the creation response. Use `net_received_jpy` in `payment.settled` to record the deposit.

Notifications for failure, cancellation, and expiry mean no funds moved, so `fee_jpy` and `net_received_jpy` are `"0"`. Even though `amount_jpy` still holds the order amount, it does not mean that a deposit to the merchant succeeded. Base your deposit recording on `payment.settled` or on `settled` from a server-to-server lookup.

## Delivery and handling

A successful receipt is a `2xx`. Implement [signature verification](/webhooks/signature), the [retry policy](/webhooks/retry), and [idempotency](/webhooks/idempotency). Make sure unknown types can be safely ignored.

There is no notification for `nonce_conflict`. Confirm it with the status lookup API and operational investigation.

## Test notifications {/* #test-notifications */}

Only the test notification sent from the merchant console keeps `type` as `payment.settled` and carries `test: true` in the body. Regular notifications have no `test` key. The IDs start with `evt_test_` and `pi_test_` and do not point to a real payment or order. The value of each field is in `TestWebhookEvent` in the body in the [OpenAPI specification](pathname:///openapi/#operation/receivePaymentEvent).

For the procedure on the receiving side, see [Receiving test notifications](/webhooks/events#test-notifications).
