---
title: Test scenarios
sidebar_label: Test scenarios
sidebar_position: 2
---

# Test scenarios

Use this checklist to confirm that behavior matches this guide. Record items you cannot reproduce as unverified, not as successful.

## Creating a payment

- [ ] When you create a payment with `amountJpy` as a string, the create response and `checkoutUrl` are returned
- [ ] When you pass the amount as a JSON number, or create a payment without `amountJpy`, the request is rejected with 400 `common/invalid_request`
- [ ] When you resend the same `orderId` consecutively or concurrently, the same payment is returned and no duplicate is created
- [ ] When you create again with the same `orderId` as a payment that has expired, the existing `expired` payment is returned, and you do not send the buyer to `checkoutUrl` but handle it by `status`
- [ ] When you call with a nonexistent ID or invalid input, the error is returned in the form `{ code, details? }`

## Looking up the status

- [ ] When you call the status lookup API without an authentication header, only the [fields of the status lookup response](/reference/rest#retrieve-payment) are returned, and the amount is not included

## Moving to the checkout page

- [ ] When you do a [top-level navigation](/reference/glossary) to the `checkoutUrl` in the create response, you reach the checkout page

## How the status progresses

- [ ] When the buyer pays from their balance, the status goes from `signed` to `deposit_confirmed` without waiting for deposit detection
- [ ] When the buyer pays with a deposit of JPYC issued through JPYC EX, the status goes from `issue_pending` to `deposit_confirmed`
- [ ] When only the missing amount is issued, the status goes to `deposit_confirmed` if the current balance plus the issued amount is enough
- [ ] For a payment that uses a wallet for the first time, the status goes through `deploying`, returns to `deposit_confirmed`, and the payment is executed after that
- [ ] When the operation deadline passes without a signature, the status goes from `created` to `expired`
- [ ] After an issuance reservation, when the deposit is not complete by the deposit deadline (the issuance reservation deadline plus 14 days, or `merchantExpiresAt` if you specified it and it is earlier) plus the confirmation-wait grace period, the status goes from `issue_pending` to `expired`
- [ ] When a deposit arrives for a payment whose `canceled` status is final, the payment is not revived and the funds remain in the buyer's wallet
- [ ] When STBLpay cannot observe a cancellation at JPYC EX, it does not treat it as STBLpay's `canceled`, and monitoring continues

## Receiving Webhooks

- [ ] When a payment reaches a terminal state, you can handle each of `payment.settled`, `payment.failed`, `payment.canceled`, and `payment.expired`
- [ ] When the transfer reaches a state where its outcome cannot be determined (`nonce_conflict`), you can detect it with a status lookup without waiting for a Webhook, and ask the [contact](/support/troubleshooting#contact) to investigate
- [ ] When the raw body is tampered with, or the time exceeds the allowed range, the Webhook is not accepted
- [ ] When you send a test notification from the merchant console (`type` is `payment.settled` and the body has `test: true`), you return `2xx` without changing any order. You check `test` on the value right after `JSON.parse` of the received body, not on a value after schema validation has dropped unknown keys
- [ ] When two `v1` values (old and new) are attached, verification works wherever the signature for the secret you currently hold is positioned
- [ ] When you resend with only the event ID in the header changed, the body's `id` prevents double processing
- [ ] When the process stops just before saving the event, it does not return a success response, and recovers on resend
- [ ] When the process stops after saving the event and before updating the order, it can resume from the unprocessed event
- [ ] When a Webhook and a status lookup arrive at the same time, the order update, shipping, and notification run exactly once
- [ ] When an unknown event type arrives, it is ignored without changing the order
- [ ] When an unknown `failed_reason` value arrives, the Webhook is not rejected and is handled as a failure fallback

## Checking on return

- [ ] When you tamper with the query of the browser's return destination, the order is not marked as paid

Refunds are available only through the Transaction details (取引の詳細) screen of the merchant console. To test a refund, prepare the owner's passkey approval and a balance in the receiving wallet.
