---
title: Scope of refunds
sidebar_label: Scope of refunds
sidebar_position: 1
---

# Scope of refunds

**Currently, the only refund path is for the merchant's owner to approve the refund with a passkey from the payment detail screen of the merchant console.** There is no refund API that your server can call.

- **Refund operation**: Start from Refund (返金) on the Transaction details (取引の詳細) screen of the merchant console ([procedure](/refunds/execute))
- **Approval**: The owner's passkey. Without approval, the refund is not executed
- **Refund destination**: Fixed to the original payer's wallet. You cannot change it on the screen or through an API
- **Amount**: You can refund the full amount, a partial amount, or split a refund across multiple refunds. The total per payment cannot exceed the original payment amount
- **Refunds from the merchant server**: Not provided. A merchant API key cannot issue refunds

STBLpay does not provide machine refunds, which execute a refund with a key on the merchant server (including `@stbl-pay/refund-sdk`).

## Refunds and payment status

A refund does not return the original payment to `canceled`. The original payment stays `settled`, and neither the payment status nor the `payment.*` Webhooks change. **There is no Webhook that announces refund completion.** Check the result in the refund history on the transaction details screen.

## Relationship with the merchant server

Decide on your side, for example in your order management system, when to start a refund, and have an operations person perform it in the merchant console. Mark your own order as refunded only after you confirm Refund completed (返金完了) in the console history.

See [Refund procedure](/refunds/execute), [Refundable amount and funding source](/refunds/funding), and [When a refund is not possible](/refunds/errors).
