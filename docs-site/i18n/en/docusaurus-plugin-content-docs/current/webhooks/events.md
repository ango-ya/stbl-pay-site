---
title: Events and receiving
sidebar_label: Events and receiving
sidebar_position: 1
---

# Events and receiving

Webhooks notify the merchant server of the terminal result of a payment. The shape of each notification is described in the [Webhook reference](/reference/webhook-events).

- **`payment.settled`**: The payment succeeded. Mark the corresponding order as paid exactly once.
- **`payment.failed`**: The payment failed. Treat the unfulfilled order as failed, and investigate if needed.
- **`payment.canceled`**: The buyer canceled the payment on My Page. Close the unfulfilled order. Do not confuse this with canceling an issuance reservation.
- **`payment.expired`**: The deadline passed. Close the unfulfilled order. This includes payments that expired without being signed.

For notifications other than `payment.settled`, `fee_jpy` and `net_received_jpy` are `"0"`, and `amount_jpy` stays at the order amount ([Amounts](/reference/webhook-events#amounts)).

The same payment never reaches more than one terminal state. A notification itself is retried, so it may arrive more than once.

## Receiving flow

1. Verify the [signature and timestamp over the raw body](/webhooks/signature).
2. **Immediately after signature verification, before any business processing, determine whether it is a [test notification](#test-notifications).**
3. Validate the JSON shape, and ignore unknown event types without changing any order.
4. Persist the event, keyed by the `id` of the signature-verified body.
5. Return `2xx` only after persisting succeeds. Run business processing in a retryable worker.
6. Verify that the payment ID matches the order, then perform an [idempotent order update](/webhooks/idempotency).

## States that are not notified

`nonce_conflict` is not notified, because the outcome, including whether a transfer was made, cannot be determined. Reconcile unconfirmed orders with the [status lookup API](/server/retrieve-payment) and follow up through operational investigation. In-progress states are also not notified by Webhook one by one.

Merchant account events and refund completion are not part of the payment Webhook events.

## Test notifications {/* #test-notifications */}

In the merchant console, open the target online store from the menu item 「お店と QR コード」 (Store & QR code). In the 「組み込みの準備」 (Integration setup) tab, under 「お支払い完了のお知らせ先」 (Payment completion notification endpoint), use 「テスト送信」 (Test delivery) to send a test notification that checks your receiving endpoint. Check the checkbox confirming that you have finished the receiving-side handling, then press 「テスト通知を送る」 (Send test notification). It is sent once to the saved URL and is not retried. The limit is 5 per minute.

A test notification is not a new event type. **The body contains `test: true`.** Regular notifications have no `test` key. For the body shape (such as the ID prefix), see the [reference](/reference/webhook-events#test-notifications).

**Immediately after verifying the signature, before any business processing,** the receiver checks whether `test === true` on the value obtained by running `JSON.parse` on the received raw body. If it matches, return `2xx` without changing any order or payment state.

```js
const parsed = JSON.parse(rawBody.toString('utf8')); // after signature verification
if (parsed.test === true) return res.sendStatus(200); // respond without changing the order
```

Check `test === true` on the value right after `JSON.parse` of the raw body. Do not check it on a value that has passed through validation that discards unneeded keys. Unknown keys are dropped, `test` disappears, and the notification looks like a genuine settled notification. Processing a test notification as a settled notification may mark a nonexistent order as paid. The check on the screen does not guarantee that the receiving side is safe, so send the test only after you have finished the handling.

For the payload, see the [Webhook reference](/reference/webhook-events).
