---
title: Client and server responsibilities
sidebar_label: Client and server responsibilities
sidebar_position: 2
---

# Client and server responsibilities

The merchant server is responsible for the amount, order authorization, and the decision to deliver goods.

| Task | Responsible party |
|---|---|
| Finalizing the order, verifying the owner, calculating the price | Merchant server |
| Creating the payment with the API key | Merchant server |
| Saving the order-to-payment ID mapping | Merchant server |
| Top-level navigation to `checkoutUrl` | Merchant's browser screen |
| Confirming the payment details, passkey signature | STBLpay checkout page |
| Applying for JPYC issuance, approving the issuance reservation, transaction decisions | JPYC EX screen (the buyer deals with JPYC EX directly; STBLpay is not involved) |
| Webhook verification, status lookup, order update, goods delivery | Merchant server |
| Showing order status after the buyer returns | Merchant site screen |

Do not trust the amount or `status` sent from the browser. Receive the order ID and calculate the price from the data stored on your own server.

Keep the API key and the Webhook signing secret only on the server. Do not reproduce passkey signing on a merchant page, and do not embed the checkout screen.

Refunds use a different authority and path from receiving payment results. The only path is for the owner to approve with a passkey in the merchant console. Merchant servers cannot call a refund API (none exists). See [Scope of refunds](/refunds/overview).
