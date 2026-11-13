---
title: Refund scope
---

# Refund scope

The owner approves console refunds with a passkey. [Refunds from merchant servers](/refunds/machine-api) are documented as a draft for preview review, pending advance sharing with JPYC EX. This does not announce production availability. Payment API keys cannot execute refunds.

Refunds go only to the original payer. Full, partial and repeated refunds are supported. Cumulative refunds cannot exceed the original payment amount; each refund cannot exceed the refundable balance at that time. The original payment stays `settled`; refund results use separate `refund.confirmed` and `refund.failed` events in the draft specification. An accepted refund is not complete: reconcile by query if notifications do not arrive.

See [console procedure](/refunds/execute), [funding](/refunds/funding) and [errors](/refunds/errors).
