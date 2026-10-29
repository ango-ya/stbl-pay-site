---
title: FAQ
sidebar_label: FAQ
sidebar_position: 1
---

# FAQ

## Do I need to build a checkout screen too?

No. The STBLpay checkout page handles payment confirmation and passkey approval. Example: the merchant builds only the "Pay" button, and the screen after it is pressed belongs to STBLpay.

## Is the payment complete when the create payment API returns?

No. The API has only created a payment intent (a record of the payment request), and the status at this point is `created` (waiting for signature). Confirm completion with the Webhook `payment.settled`, or with `settled` from a [status lookup](/reference/rest#retrieve-payment). Be ready to check with a status lookup too, in case a notification does not arrive. Example: do not provide the goods when you receive the create API response. Wait until you confirm `settled`. See [Completion check](/lifecycle/completion).

## Can I choose `orderId` freely?

Yes. You can use your own order number as is (up to 128 characters). Assign numbers so they are unique across the whole merchant. Example: use your system's order number, such as `ord_0001`. If you create a payment again with the same `orderId`, the existing payment is returned.

## What is a top-level navigation?

It means moving to `checkoutUrl` with the whole page, like an ordinary link. Do not put it in an iframe or popup. Example: navigate with `window.location.href = checkoutUrl`. This makes sure passkey approval happens on the right page and prevents the page from being swapped for a fake screen. The [glossary](/reference/glossary) also defines the term.

## When does the buyer return to the merchant site after payment?

When the payment reaches a terminal state, the STBLpay checkout page shows a button back to the merchant. Whether the payment succeeded, failed, expired, was canceled, or ended in `nonce_conflict`, the button goes to the `returnUrl` you specified when creating the payment. If you did not specify `returnUrl`, no button is shown and the page says "You may close this tab" (このタブは閉じていただいてかまいません). Example: on the return page, show "Checking" and switch based on the order status on the server side. The return does not wait for the Webhook, so the buyer may return before the order is updated. Some buyers do not return. If a merchant suspension aborts the payment, no button is shown even if you specified `returnUrl`, and the page says "Close this screen and place the order again from the store's page." (この画面を閉じて、お店のページからご注文をやり直してください。) Do not use the buyer's return as the basis for success.

## Do I need an SDK?

No. We do not provide a merchant integration SDK. After you create the payment, navigate to `checkoutUrl`. See [How to integrate today](/client/install).

## Can I retry creating the same order?

Yes. The same store gets the existing payment back for the same `orderId`. Do not generate a new number on every communication failure. Retrying does not update the amount or deadline of an existing payment. The payment that comes back may already be terminal (it goes no further), so check `status` in the response before sending the buyer to `checkoutUrl`. How to handle each status is in [Idempotency](/server/create-payment#idempotency).

## Is the amount a number?

No. API amounts are strings in yen, and Webhook amounts are strings too. In the `payment.failed`, `payment.canceled`, and `payment.expired` notifications, `fee_jpy` and `net_received_jpy` are `"0"` ([Amounts](/reference/webhook-events#amounts)). The status lookup API does not return the amount or the fee.

## Can I provide the goods once it is signed?

No. `signed` and `deposit_confirmed` are in-progress statuses. [Confirm success on the server](/lifecycle/completion), then provide the goods exactly once.

## Which Webhooks are delivered?

Four kinds: success, failure, cancellation, and expiry. For `nonce_conflict`, you need to run a status lookup and investigate. Deduplicate by the `id` in the signature-verified body. A test notification sent from the merchant console has the `payment.settled` form with `test: true` in the body. Return `2xx` without changing any order ([Test notifications](/webhooks/events#test-notifications)). The body is defined in `WebhookEvent` and `TestWebhookEvent` in the [OpenAPI specification](pathname:///openapi.yaml).

## Can a payment succeed after cancellation?

No. The API's `canceled` is a terminal state, so the payment does not succeed. Distinguish this from the case where STBLpay cannot observe the cancellation of a reservation at the issuer and the payment is still `issue_pending`.

## When do I close an order that never comes back?

Do not use a fixed elapsed time. Judge by whether a status lookup or a Webhook shows a terminal status such as `expired` (see [Operation deadline and deposit deadline](/lifecycle/transitions#operation-deadline-and-deposit-deadline)). If you close your own order first, detect any later success and route it to operational handling.

## Can I use a refund API?

No. There is no refund API that you can call from the merchant server. The owner makes refunds from the Transaction details (取引の詳細) screen of the merchant console and approves them with a passkey. The refund destination is fixed to the original payer. See [Scope of refunds](/refunds/overview).

## Is the payment ID a secret?

No. Apply your own authentication and authorization when you let people view your own orders.

## Is there an environment for trying my integration?

Yes, the [Sandbox](/testing/sandbox). The items to check are in [Test scenarios](/testing/scenarios).
