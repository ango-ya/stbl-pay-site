---
title: Scope of refunds
sidebar_label: Scope of refunds
sidebar_position: 1
---

# Scope of refunds

**Currently, the only refund path is for the merchant's owner to approve it with a passkey from the payment detail screen of the merchant console.** There is no refund API that the merchant server can call.

- **Refund operation**: Done from 「返金」 (Refund) on the 「取引の詳細」 (Transaction details) screen of the merchant console ([procedure](/refunds/execute))
- **Approval**: The owner's passkey. Without approval, the refund is not executed
- **Refund destination**: Fixed to the original payer's wallet. It cannot be changed on the screen or through an API
- **Amount**: Full, partial, and multiple split refunds are possible. The total per payment does not exceed the original payment amount
- **Refunds from the merchant server**: Not provided. A merchant API key cannot issue refunds

Machine refunds that execute a refund with a key on the merchant server (including `@stbl-pay/refund-sdk`) are not provided.

## Refunds and payment status

A refund is not an operation that returns the original payment to `canceled`. The original payment stays `settled`, and neither the payment status nor the `payment.*` Webhooks change. **There is no Webhook that announces refund completion.** Check the result in the refund history on the transaction details screen.

## Relationship with the merchant server

Decide on your side, such as in your order management system, when to start a refund, and have an operations person perform it in the merchant console. Mark your own order as refunded only after you confirm 「返金完了」 (Refund completed) in the console history.

See [Refund procedure](/refunds/execute), [Refundable amount and funding source](/refunds/funding), and [When a refund is not possible](/refunds/errors).
