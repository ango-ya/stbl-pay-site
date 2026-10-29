---
title: Managing API keys
sidebar_label: Managing API keys
sidebar_position: 1
---

# Managing API keys

The API key for creating payments and the Webhook signing secret for verifying notifications serve different purposes.

| Secret | Purpose | Where to store it |
|---|---|---|
| Payment API key | Authenticates the merchant server with `x-stbl-api-key` | The server's secret management system |
| Webhook signing secret | Verifies the HMAC of the raw body | The server's secret management system |

Never expose secrets in HTML, browser JavaScript, Git, or access logs. Manage the endpoint URL and the key together as a set for each environment. Do not tell production from sandbox by the key prefix alone.

## Issuing and revoking payment API keys

You issue and revoke payment API keys **per store** in the merchant console. In the merchant console menu, open the target online store from Store & QR code (お店と QR コード). On the Integration setup (組み込みの準備) tab, go to Keys for creating payments (お支払いを作るための鍵) and click Issue API key (API キーを発行). The label is optional and can be up to 64 characters.

- The format is `stblpay_` followed by 43 base64url characters.
- **The plaintext key is shown only once, when you issue it.** The server stores only a SHA-256 hash, so the key cannot be shown again after you close the screen. Store it only on the merchant server. If you could not save it, revoke that key and issue a new one.
- The list shows a masked key (only the beginning and end), the issue date and time, and the last-used date and time.
- **Each store can have up to 10 active keys.** If you try to issue more, the request returns 409 `store/api_key_limit_reached`. Revoke unused keys before you issue a new one.
- To revoke a key, click Revoke (失効) in the list. **Revocation takes effect immediately and cannot be undone.** Requests from servers that use that key are rejected.
- You can issue and revoke API keys while the store is suspended with Suspend (停止する). While the store is suspended, it does not accept new payments.
- While STBLpay has suspended the merchant, you cannot issue or revoke API keys. See [Merchant suspension](/lifecycle/edge-cases#merchant-suspension).

A store can hold multiple keys so that you can rotate keys without stopping payments. For example, rotate in this order:

1. Issue a new key.
2. Switch the server to the new key.
3. Confirm that the old key's last-used time is no longer updated, then revoke the old key.

If a store could hold only one key, you could not create payments during rotation. If you use a separate key for each server, a leak from one server requires revoking only that key, and the other servers keep working.

## Rotation and compromise

If a key leaks, stop it with Revoke (失効), issue a new key, and replace the key on your servers. Check the key's usage (last-used time) and the affected orders. Only the merchant, logged in to the merchant console, can issue and revoke keys. You cannot do it with a payment API key.

You manage the Webhook signing secret in the merchant console. From the menu, open the target online store from Store & QR code (お店と QR コード). On the Integration setup (組み込みの準備) tab, go to Payment completion notification endpoint (お支払い完了のお知らせ先). The secret is shown only once, at first setup, and does not change when you change the URL. If you click Regenerate signing secret (署名鍵を作り直す), both the old and new secrets are valid for 24 hours, and during that time the header contains two `v1` values. If you suspect the secret is compromised, do not regenerate it. Instead, click Remove webhook (webhook を解除) and set it up again. The endpoint URL and the signing secret are set once per merchant, so both regenerating and removing affect notifications for every online store. For the procedure, see [Signature verification](/webhooks/signature#if-the-key-is-compromised).
