---
title: Signature verification
sidebar_label: Signature verification
sidebar_position: 2
---

# Signature verification

If you rely on a Webhook to confirm an order, you must verify the signature and timestamp, and process events idempotently by event ID.

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

Configure the Webhook in the merchant console: open the target online store from the menu item 「お店と QR コード」 (Store & QR code), then use 「お支払い完了のお知らせ先」 (Payment completion notification endpoint) in the 「組み込みの準備」 (Integration setup) tab.

- **The signing secret is issued when you first set the endpoint URL, and it is shown only then.** It cannot be shown again after you close the screen. Store it in the secret management system of your receiving server. If you fail to save it, regenerate the signing secret.
- **Changing the URL does not change the signing secret.** 「URL を変更」 (Change URL) does not issue a secret.
- **When you press 「署名鍵を作り直す」 (Regenerate signing secret), both the new secret and the current secret are valid for only 24 hours.** The current secret remains as the previous signing secret, and its expiry time is shown on the screen. During this period, the signature header contains two `v1` values. The receiver collects both, and accepts the request if the value computed with a secret it holds matches either one. Switch your receiver to the new secret within the 24 hours.
- **While the previous signing secret is still valid, you cannot regenerate again** (409 `merchant/webhook_rotation_pending`; the expiry is in `details.previousSecretExpiresAt`). You can regenerate once the expiry has passed. Requests are not signed with a previous secret past its expiry.

## If the key is compromised {/* #if-the-key-is-compromised */}

Regenerating the signing secret keeps the previous signing secret for 24 hours, so it cannot be used to respond to a leak. **Use 「webhook を解除」 (Remove webhook), then set it up again.**

- Removing it deletes both the new and previous signing secrets (the previous one is also invalidated immediately).
- Undelivered and pending-retry notifications are discarded. **Setting up again does not resume discarded notifications.** Setting up again issues a new signing secret.
- Notifications already being sent may not be cancelable.
- Reconcile the results of discarded payments with the [status lookup](/server/retrieve-payment) (`GET /payment_status/:paymentIntentId`). The payments themselves are not canceled.
- On the receiving side as well, delete the old signing secret.

Notifications for payments that occurred while no Webhook was configured are not sent even if you configure one later. Likewise, reconcile them with the status lookup.

Do not output the signing secret to the browser or logs. [Event persistence and deduplication](/webhooks/idempotency) are also required.
