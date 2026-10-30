---
title: Events and receiving
sidebar_label: Events and receiving
sidebar_position: 1
---

# Events and receiving

Webhooks notify your server of the terminal result of a payment. The shape of each notification is described in the [Webhook reference](/reference/webhook-events).

- **`payment.settled`**: The payment succeeded. Mark the corresponding order as paid exactly once.
- **`payment.failed`**: The payment failed. Mark the unfulfilled order as failed, and investigate if needed.
- **`payment.canceled`**: The buyer canceled the payment on My Page. Close the unfulfilled order. Do not confuse this with canceling an issuance reservation.
- **`payment.expired`**: The deadline passed. Close the unfulfilled order. This includes payments that expired without being signed.

For notifications other than `payment.settled`, `fee_jpy` and `net_received_jpy` are `"0"`, and `amount_jpy` stays at the order amount ([Amounts](/reference/webhook-events#amounts)).

A payment never reaches more than one terminal state. However, STBLpay retries notifications, so the same notification may arrive more than once.

## Receiving flow

1. Verify the [signature and timestamp over the raw body](/webhooks/signature).
2. **Immediately after signature verification, before any business processing, determine whether it is a [test notification](#test-notifications).**
3. Validate the JSON shape, and ignore unknown event types without changing any order.
4. Persist the event, keyed by the `id` of the signature-verified body.
5. Return `2xx` only after persisting succeeds. Run business processing in a retryable worker.
6. Verify that the payment ID matches the order, then perform an [idempotent order update](/webhooks/idempotency).

Each merchant has a single Webhook destination, so notifications for the same merchant's in-store QR code payments also arrive there. For in-store payments, `order_id` is null. Because `orderId` can be omitted when creating a payment, you cannot tell in-store payments apart by whether `order_id` is null. For a notification whose `payment_intent_id` does not correspond to any of your orders, still perform steps 1 to 5 and return `2xx`. Then mark it as processed without changing any order. Do not link it to a different order.

## States that are not notified

STBLpay does not send a notification for `nonce_conflict`, because the outcome cannot be determined, including whether a transfer was made. Reconcile unconfirmed orders with the [status lookup API](/server/retrieve-payment) and investigate them operationally. STBLpay also does not send a Webhook for each in-progress state.

Merchant account events and refund completion are not payment Webhook events.

## Test notifications {/* #test-notifications */}

The body of a test notification is defined in `TestWebhookEvent` in the [OpenAPI specification](pathname:///openapi/#operation/receivePaymentEvent).

You can send a test notification to check that your endpoint works. In the merchant console, open Store & QR code (お店と QR コード) from the menu and select your online store. In the Integration setup (組み込みの準備) tab, go to Payment completion notification endpoint (お支払い完了のお知らせ先) and find Test delivery (テスト送信). Select the checkbox that confirms you have finished the receiving-side handling, then click Send test notification (テスト通知を送る). STBLpay sends the notification once to the saved URL and does not retry. You can send up to 5 per minute.

A test notification is not a new event type. **The body contains `test: true`.** Regular notifications have no `test` key. For the body shape (such as the ID prefix), see the [reference](/reference/webhook-events#test-notifications).

**Immediately after verifying the signature, before any business processing,** check whether `test === true` on the value you get from running `JSON.parse` on the received raw body. If it matches, return `2xx` without changing any order or payment state.

```js
const parsed = JSON.parse(rawBody.toString('utf8')); // after signature verification
if (parsed.test === true) return res.sendStatus(200); // respond without changing the order
```

Check `test === true` on the value right after `JSON.parse` of the raw body. Do not check it on a value that has passed through validation that discards unneeded keys. Such validation drops unknown keys, so `test` disappears and the notification looks like a genuine settled notification. Processing a test notification as a settled notification may mark a nonexistent order as paid. The checkbox on the screen does not guarantee that your receiver is safe, so finish the handling before you send a test.

For the payload, see the [Webhook reference](/reference/webhook-events).
