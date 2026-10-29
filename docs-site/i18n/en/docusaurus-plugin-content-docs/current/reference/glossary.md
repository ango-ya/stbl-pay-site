---
title: Glossary
sidebar_label: Glossary
sidebar_position: 4
---

# Glossary

Terms used in the guide, grouped by theme. For more on the blockchain side, see [Technical details](/lifecycle/transitions#technical-details).

## How a payment progresses

- **Create a payment**: Registering the amount and order number with STBLpay so that it creates a record of the payment request. This is the operation of calling `POST /payment_intents`, and you send the buyer to the `checkoutUrl` it returns.
- **Payment intent**: The record of the payment request you created. You tell them apart by `paymentIntentId`. Example: order `ord_0001` gets exactly one `paymentIntentId`.
- **Settled (succeeded)**: The state in which the merchant may deliver the goods. It refers only to when the status becomes `settled`. As an exception, an order whose `nonce_conflict` investigation came back saying the transfer happened is treated as settled, even though the status stays `nonce_conflict` (see [The transfer result cannot be determined](/lifecycle/edge-cases#nonce-conflict)).
- **Terminal**: The state in which the payment goes no further. `settled`, `failed`, `canceled`, `expired`, and `nonce_conflict` apply. Their meanings are in [Status values](/reference/rest#status-values). A payment that has reached a terminal state never changes to another status.
- **Transition**: The status of a payment changing to another status. Example: changing from `created` to `signed`.
- **Allocation**: Deciding which payment a deposit is treated as paying for. One deposit can be allocated to more than one payment (for example, when the buyer pays for several orders in one transfer).
- **Operation deadline**: The deadline by which the buyer must sign and start the payment. You can check it in `checkoutExpiresAt`.
- **Deposit deadline**: For a payment made by bank transfer, the deadline to wait for the deposit. It is determined separately from the operation deadline.

## Confirmation and reconciliation

- **Lookup**: The merchant server asking STBLpay for the current status of a payment. Covered in [Retrieve payment status](/server/retrieve-payment).
- **Reconciliation**: Comparing the merchant's orders against the status of STBLpay payments to find discrepancies. Example: periodically looking up orders for which you did not receive a Webhook.
- **Idempotent**: Repeating the same operation any number of times gives the same result as doing it once. Example: even if you create a payment again with the same `orderId`, as a rule you do not get two payments and the same one is returned (for exceptions such as merchant suspension, see [idempotency](/server/create-payment#idempotency)). Even if the same Webhook arrives twice, you do not deliver the goods twice.
- **Responsibility**: The assignment of who handles a task. Example: the passkey signature is handled by the checkout page, and confirming the order is handled by the merchant server. See [Client and server responsibilities](/getting-started/responsibilities).
- **`txHash`**: The transaction number on the blockchain. Use it when contacting STBLpay.

## Screen navigation and domains

- **origin**: The combination of scheme, hostname, and port in a URL (examples: `https://shop.example.com`, `https://shop.example.com:8443`). If any one of these differs, it is treated as a different origin. A URL with the port omitted is compared as the default port (443 for `https`), so `https://shop.example.com` and `https://shop.example.com:443` are the same origin.
- **Checkout page**: The page provided by STBLpay where the buyer signs with a passkey. You open it with `checkoutUrl`.
- **Top-level navigation**: Moving the whole browser window to another URL. Example: `window.location.assign(checkoutUrl)`. Embedding the checkout page in an iframe, popup, or modal is not a top-level navigation.
- **`returnUrl`**: The URL of the page the buyer returns to after payment. Specify an `https://` page on a registered domain. Conditions and examples are in [Domain registration](/security/domain#returnurl-requirements).
- **Open redirect**: A trusted site being able to send a user to an arbitrary URL. It is abused to lead users to fake sites. STBLpay limits `returnUrl` to registered domains to prevent this.
- **userinfo**: The username and password that a URL can contain (the `user:pass@` part of `https://user:pass@example.com/`). It cannot be used in `returnUrl` or in a Webhook destination.

## Notifications

- **at-least-once**: A scheme that attempts delivery of a notification "at least once". Resends have a limit, and delivery is not guaranteed. The same notification may arrive two or more times, so the receiver removes duplicates.
- **raw body**: The body of a received Webhook as it was received, before it is parsed as JSON. Signature verification is done against this body.
- **`id` of the signature-verified body**: The ID of the notification, read after it passes signature verification. Use it as the key to recognize duplicate notifications.

## JPYC and the flow of money

- **JPYC**: A yen-denominated stablecoin where 1 JPYC = 1 yen. Used for STBLpay payments.
- **JPYC EX**: The issuer's platform that handles issuance and redemption of JPYC. Buyers and merchants deal with it directly.
- **Issuance**: JPYC EX delivering to a wallet the same amount of JPYC as the yen paid in. The buyer applies for issuance on JPYC EX and pays in yen by bank transfer.
- **Redemption**: Returning JPYC to JPYC EX to turn it into yen.
- **Polygon**: The blockchain on which JPYC moves. The buyer's wallet and the merchant's receiving wallet are on it.
- **Receiving wallet**: The wallet, one per merchant, that receives the JPYC of payments. It is tied to the owner's passkey. The address is `payout` in the Webhook. For details, see [Money flow](/getting-started/money-flow).

## Blockchain terms

The guide's main text rephrases the following terms in plain language. Their meanings are in [Technical details](/lifecycle/transitions#technical-details).

- **Waiting until the deposit can no longer be reversed**
- **Payment operation** (the operation for payment that the buyer signs)
- **Creating the wallet**
- **A state in which the result of the transfer cannot be determined** (`nonce_conflict`)
