---
title: Handling edge cases
sidebar_label: Handling edge cases
sidebar_position: 4
---

# Handling edge cases

Check the payment status, the buyer's screen actions, and the status of your own order separately.

## The browser was closed or the buyer does not return

A payment can progress even if the browser does not return. `created` before signing and `signed` before the reservation have an operation expiry, and after the reservation there is a separate deposit deadline. Decide using Webhooks and status lookups, and do not decide that a payment failed based only on elapsed time.

## The create request timed out

It is unknown whether the payment was created, so retry with the same `orderId`. Issuing a new order number can create a different payment.

## Cannot retrieve the status

Do not convert a communication error or an unknown response into `failed`. Put the order under review and look it up again after an interval. For a 404, check the ID, the destination, and the data retention of the environment.

## The reservation was canceled at the issuer

After the reservation, the buyer cancels on the JPYC EX screen. If STBLpay cannot observe that the cancellation completed, the payment stays in `issue_pending` and monitoring continues. If a matching deposit within the deadline is observed in this status, the payment proceeds through the normal payment flow.

This is **not the revival of a payment that STBLpay finalized as `canceled`**. A payment for which the API returned `canceled` is terminal, and it does not become `settled` even if a deposit arrives later. The funds remain in the buyer's wallet.

## The payment succeeded after you closed your own order

Your own inventory hold deadline and STBLpay's payment deadline are separate. If STBLpay's payment has not reached a terminal status, it may still succeed. Detect and hold a deposit for an order you cannot fulfill, and escalate it to an operations contact. A refund is available only through the route where an owner approves it from the payment details screen (決済詳細画面) in the merchant console. The merchant server cannot refund automatically ([Scope of refunds](/refunds/overview)).

## Merchant suspension {/* #merchant-suspension */}

Suspension is an operation in which the operator stops providing the service to that merchant, for example after receiving a report of a terms violation. It does not cancel payments that were already signed, and it does not freeze the buyer's funds. API keys are not revoked, so they can be used as they are once the merchant is reinstated.

- **Creating a payment while suspended**: Returns 403 `merchant/suspended`
- **A payment created before the suspension that has not yet started sending**: Ends as `failed`. `failed_reason` is `merchant_suspended`. A `payment.failed` Webhook is also sent
- **A payment that has already started sending**: Keep checking the result. Do not decide success or failure based only on the suspension
- **Creating with the same `orderId` after reinstatement**: If the existing payment was aborted by the suspension, or was created before the suspension and had not yet started sending, the result is 409 `payment/order_terminated`

**For a payment that has already started sending, `payment.settled` may arrive after the suspension. If it arrives, treat it as a successful payment as usual.** Do not ignore a settled notification or close the order because of the suspension.

If 409 `payment/order_terminated` is returned, **create a new payment with a new `orderId`** ([Idempotency](/server/create-payment#idempotency)). A payment aborted by suspension is not revived after reinstatement. JPYC already deposited remains in the buyer's own wallet.

## Duplicate or missing notifications

Prevent duplicates with the `id` of the signature-verified body and a conditional update of the order. After recovering from an outage or after retries were abandoned, reconcile unconfirmed orders with the API. The absence of a notification alone does not mean the payment is unpaid.

## The transfer result cannot be determined (`nonce_conflict`)

`nonce_conflict` is terminal, but it means the transfer result could not be determined and the confirmation limit was reached. It is unknown whether the transfer happened, or whether it succeeded or failed. This also applies when failures to read the number (nonce) continued up to the limit ([Technical details](/lifecycle/transitions#technical-details)). There is no Webhook. Detect it with the status API, stop automatic shipping and re-charging, and send it to operational investigation.
