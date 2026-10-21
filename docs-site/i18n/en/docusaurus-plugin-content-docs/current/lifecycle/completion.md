---
title: What counts as a completed payment
sidebar_label: What counts as a completed payment
sidebar_position: 3
---

# What counts as a completed payment

**The merchant server confirms `settled`, verifies that it matches the order, and provides the goods exactly once.**

## Basis for a successful payment

The ways to confirm completion are as follows.

- **`payment.settled` Webhook**: Verify the signature and timestamp on the raw body, and process idempotently by the `id` in the body
- **Server-to-server lookup with the status API**: Confirm `settled` using the payment ID saved at creation

Use the Webhook as the main path for result notification, and use the API for a confirming lookup when needed and for periodic [reconciliation](/reference/glossary) when notifications are missing. Do not make it a required condition for providing goods that both arrive. If you did, a settled order would stall when a notification is missing.

None of the following can be used as a basis for success: a `status` from the browser, a query on the return URL, or the tab coming back.

## Matching the order and providing exactly once

1. Confirm that it matches the payment ID saved on your own order.
2. For a Webhook, also confirm that it matches the merchant, the order, and the amount at creation. Send any mismatch to investigation.
3. Update the order status conditionally, and create the outbox for providing goods in the same DB transaction.
4. Run external delivery of goods and email sending using an idempotency key such as the order ID.

If you only mark the received event as "processed" first and then run external processing, you will miss providing goods when processing stops midway. See [Idempotency of receiving and business processing](/webhooks/idempotency).

## Amounts and terminal statuses

Amounts in a Webhook are strings. For a settled payment, check the received amount in `net_received_jpy` and the fee in `fee_jpy`. In `payment.settled` these are the actual on-chain amounts; only when the actual amounts could not be obtained are they the estimates from creation. In `payment.failed`, `payment.canceled`, and `payment.expired`, no funds moved, so both are `"0"` (`amount_jpy` stays the order amount). Do not record the amount in a failed, canceled, or expired notification as a deposit. The status lookup API has no amounts, so match against your saved order and the creation response, and do not infer amounts from the lookup response.

`settled` is terminal. A delivery failure of a notification or a later refund does not change the original payment to another status. Send a settled notification for an order that cannot be fulfilled to operational handling.
