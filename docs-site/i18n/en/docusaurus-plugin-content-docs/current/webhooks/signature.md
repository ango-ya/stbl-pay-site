---
title: Signature verification
sidebar_label: Signature verification
sidebar_position: 2
---

# Signature verification

If you use a Webhook to confirm orders, you must verify the signature and timestamp, and process events idempotently by event ID.

## Values to verify

The signed content is the byte sequence `"<t>.<raw body>"`, and the algorithm is HMAC-SHA256. `t` is the Unix time in seconds of each delivery attempt, and it is updated on every retry. The default tolerance is 300 seconds.

For 24 hours after you regenerate the signing secret, multiple `v1` values arrive. Keep all of them, and accept the request if the value you compute with your own secret matches any one of them. Do not convert them into a dictionary that overwrites duplicate keys.

## Node.js verification example

The input `rawBody` is a Buffer from before it passes through a JSON parser.

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyStblPaySignature(rawBody, header, secret, now = Date.now()) {
  if (!Buffer.isBuffer(rawBody) || typeof header !== 'string' || !secret) return false;
  const parts = header.split(',').map((part) => part.trim());
  const timestamps = parts.filter((part) => part.startsWith('t='));
  if (timestamps.length !== 1) return false;
  const timestamp = timestamps[0].slice(2);
  if (!/^\d+$/.test(timestamp)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Math.floor(now / 1000) - seconds) > 300) {
    return false;
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();
  return parts.filter((part) => part.startsWith('v1=')).some((part) => {
    const signature = part.slice(3);
    if (!/^[0-9a-fA-F]{64}$/.test(signature)) return false;
    return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  });
}
```

STBLpay sends Webhooks with `Content-Type: application/json; charset=utf-8`. In Express, use `express.raw({ type: 'application/json' })` on the Webhook route, and register it before the generic `express.json()`. By default `express.raw()` accepts only `application/octet-stream`, so without `type` the received bytes are empty and signature verification fails. After verification, run `JSON.parse` and validate the shape of the Webhook.

Parsing JSON and serializing it again changes whitespace and key order. Use the received bytes as they are for verification. Compare signatures in a timing-safe way, and do not call `timingSafeEqual` with values of different lengths.

## Issuing and regenerating the signing secret

Configure the Webhook in the merchant console. Open Store & QR code (お店と QR コード) from the menu and select your online store. Then use Payment completion notification endpoint (お支払い完了のお知らせ先) in the Integration setup (組み込みの準備) tab.

- **The signing secret is issued when you first set the endpoint URL, and it is shown only then.** You cannot view it again after you close the screen. Store it in the secret management system of your receiving server. If you fail to save it, regenerate the signing secret.
- **Changing the URL does not change the signing secret.** Change URL (URL を変更) does not issue a secret.
- **When you click Regenerate signing secret (署名鍵を作り直す), both the new secret and the current secret are valid for only 24 hours.** The current secret remains as the previous signing secret, and its expiry time is shown on the screen. During this period, the signature header contains two `v1` values. Your receiver collects both values and accepts the request if the value computed with a secret it holds matches either one. Switch your receiver to the new secret within the 24 hours.
- **While the previous signing secret is still valid, you cannot regenerate again** (409 `merchant/webhook_rotation_pending`; the expiry is in `details.previousSecretExpiresAt`). You can regenerate once the expiry has passed. STBLpay does not sign with a previous secret after it expires.

## If the key is compromised {/* #if-the-key-is-compromised */}

Regenerating the signing secret keeps the previous signing secret valid for 24 hours, so it does not address a leak. **Use Remove webhook (webhook を解除), then set it up again.**

- Removing it deletes both the new and previous signing secrets (the previous one is also invalidated immediately).
- Undelivered and pending-retry notifications are discarded. **Setting up again does not resume discarded notifications.** Setting up again issues a new signing secret.
- Notifications already in flight may not be cancelable.
- Reconcile the results of discarded payments with the [status lookup](/server/retrieve-payment) (`GET /payment_status/:paymentIntentId`). The payments themselves are not canceled.
- On your receiving side, also delete the old signing secret.

Notifications for payments that occurred while no Webhook was configured are not sent even if you configure one later. Likewise, reconcile them with the status lookup.

Do not expose the signing secret in the browser or logs. You also need [event persistence and deduplication](/webhooks/idempotency).
