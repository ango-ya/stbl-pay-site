---
title: Integrating with an existing EC site
sidebar_label: Integrating with an existing EC site
sidebar_position: 4
---

# Integrating with an existing EC site

Manage the order and the payment as separate states. Save on the server the mapping between the order ID, the `orderId` you sent at creation, and the returned `paymentIntentId`.

## Reflecting the result in the order

| Payment check result | How the EC side handles it |
|---|---|
| The 6 in-progress statuses | Hold as awaiting payment / processing |
| `settled` | Mark as paid and schedule the goods delivery process exactly once |
| `canceled` / `expired` / `failed` | If not yet delivered, run the business process for cancellation and releasing stock |
| `nonce_conflict` | Put on hold; an operator investigates the result |

So that you never ship twice even if a Webhook and polling race, make the order update a conditional update and record the goods delivery job in the same database transaction.

## Order and stock deadlines

The EC stock hold deadline is separate from the STBLpay payment deadline. Do not decide "it will no longer succeed" after a fixed short time; compare against the [operation deadline and deposit deadline](/lifecycle/transitions) and the actual status.

Even after you close your own order, the STBLpay payment may still succeed if it has not reached a terminal state. If you detect a deposit for an order you cannot fulfill, escalate to an operator. To issue a refund, use the payment details screen in the merchant console ([Scope of refunds](/refunds/overview)).

## Double clicks and retries

Disable the button in the browser, and have the server use the same `orderId` for retries of the same order. If you change the payment conditions or start a different attempt, first check whether the existing payment could still succeed.

On the return page, authorize the order from your own session. Do not return order details just because the requester knows the payment ID.
