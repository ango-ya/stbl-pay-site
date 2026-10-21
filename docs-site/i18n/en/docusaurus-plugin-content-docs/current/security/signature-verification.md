---
title: Signature verification
sidebar_label: Signature verification
sidebar_position: 3
---

# Signature verification

If you use a Webhook as the basis for finalizing an order, always verify the signature and the time, and process idempotently by the `id` in the verified body. See the [implementation example](/webhooks/signature).

| Check | What it prevents |
|---|---|
| HMAC-SHA256 of the raw body | Forged notifications and tampered bodies |
| Allowed clock skew of the send time | Replay of old notifications |
| Timing-safe comparison | Guessing information from comparison time |
| Deduplication by the body's `id` | Double processing from resends within the allowed window |

During rotation there are multiple `v1` values, so collect all of them and check whether any one matches. Do not use the event ID that appears only in the header as the deduplication key.

## Restricting the sender

We plan to use fixed IP addresses in production. Check the actual sender information and availability, and use IP restriction in addition to signature verification. Do not use IP restriction in place of signature verification.

In a setup that does not verify signatures, you cannot use the notification body as the basis for finalizing an order. In that case, confirm success only by looking up the status through the status API from the merchant server.

Verifying the buyer's passkey signature and verifying on-chain data are the responsibility of the STBLpay payment path. Merchants do not reimplement them in the browser.
