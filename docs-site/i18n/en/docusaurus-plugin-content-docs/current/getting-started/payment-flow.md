---
title: Understand the payment flow
sidebar_label: Payment flow
sidebar_position: 1
---

# Understand the payment flow

The merchant server creates a payment, and the buyer signs with a passkey on the dedicated checkout page. Merchants do not implement the signing.

```mermaid
sequenceDiagram
    participant User as Buyer's browser
    participant Shop as Merchant server
    participant Pay as STBLpay
    participant Page as STBLpay checkout page
    User->>Shop: Start payment for an order
    Shop->>Shop: Authorize, calculate amount, save order
    Shop->>Pay: POST /payment_intents (API key)
    Pay-->>Shop: paymentIntentId and checkoutUrl
    Shop->>Shop: Save the order-to-payment ID mapping
    Shop-->>User: checkoutUrl
    User->>Page: Top-level navigation to the checkout page
    Note over User,Page: Passkey signature, and the bank transfer at the issuer if needed
    Pay->>Pay: Confirm deposit, prepare wallet, execute payment
    par Flow 1: Finalize the order (Webhook or status lookup)
        Pay-->>Shop: Webhook (terminal result, if configured)
        Shop->>Shop: Verify signature, update order idempotently
        opt Webhook not configured, or not delivered
            Shop->>Pay: Status lookup (GET /payment_status)
            Pay-->>Shop: Status such as settled
        end
    and Flow 2: Buyer returns (for display)
        Page-->>User: Show a link such as "Back to the shop"
        User->>Shop: Click the link and return to returnUrl
        opt Order not yet updated
            Shop->>Pay: Status lookup
            Pay-->>Shop: Current status
        end
        Shop-->>User: Show the result ("Checking" if unknown)
    end
```

## Payment paths

If the balance is sufficient, the payment moves from `signed` (the buyer has signed) to `deposit_confirmed` (the deposit or balance has been confirmed). If a bank transfer is needed, it moves forward after the procedure at the issuer, the detection of the deposit, and confirmation that the deposit can no longer be reversed. `issue_pending` means STBLpay received a reservation-start notification from the checkout page. STBLpay has not verified whether the procedure at JPYC EX was completed, so the payment also enters this status if the buyer abandons midway.

The payment to the merchant succeeds at `settled`, once the required wallet has been created and the payment has been executed successfully. See [Statuses and transition conditions](/lifecycle/transitions).

## Receiving the result

The result reaches the merchant through two flows. Flow 1 finalizes the order. Flow 2 returns the buyer's screen to the original store.

In flow 1, finalize the order based on the Webhook `payment.settled`, or on `settled` obtained by a [status lookup](/reference/rest#retrieve-payment) from the merchant's server. Setting up a Webhook is optional. If you do not, confirm `settled` with a status lookup before you finalize.

Webhooks notify success, failure, cancellation, and expiry. If the outcome of the transfer could not be determined (`nonce_conflict`), no Webhook is delivered, so you must check unfinalized orders with a [status lookup](/reference/rest#retrieve-payment). Do not deliver goods based only on the browser returning.

## How the buyer returns to the store

- The return link is displayed by the STBLpay checkout page. The merchant does not need to build the link. The merchant implements the handling at the return destination (`returnUrl`) page that checks and displays the order status (see below). The link appears only when the payment reaches a terminal state. On success it reads 「ショップに戻る」 (Return to shop); in the other terminal states (`failed`, `expired`, `canceled`, `nonce_conflict`) it reads 「お支払い先に戻る」 (Return to the payee). It does not appear while the payment is in progress.
- The link goes to the `returnUrl` specified when the payment was created, with the payment ID appended as the `stbl_pay_intent` query parameter. If you did not specify `returnUrl`, no link appears.
- If the order has not been updated at the return destination, check with a status lookup. The buyer may return before the Webhook arrives. If the lookup does not give a result, do not show completion; show "Checking".
- If the payment stopped because the merchant was suspended, no link is shown. The checkout page shows 「この画面を閉じて、お店のページからご注文をやり直してください。」 (Close this screen and place the order again from the store's page.)
