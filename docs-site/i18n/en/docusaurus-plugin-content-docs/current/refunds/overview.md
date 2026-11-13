---
title: Refund scope
---

# Refund scope

The owner approves console refunds with a passkey. [Refunds from merchant servers](/refunds/machine-api) are documented as a draft for preview review, pending advance sharing with JPYC EX. This does not announce production availability. Payment API keys cannot execute refunds.

Refunds go only to the original payer, up to the remaining payment amount. Full, partial and repeated refunds are supported. The original payment stays `settled`; refund results use separate `refund.confirmed` and `refund.failed` events in the draft specification. An accepted refund is not complete: reconcile by query if notifications do not arrive.

See [console procedure](/refunds/execute), [funding](/refunds/funding) and [errors](/refunds/errors).
