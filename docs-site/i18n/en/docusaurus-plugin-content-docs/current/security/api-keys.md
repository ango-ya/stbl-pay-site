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

Do not expose secrets in HTML, browser JavaScript, Git, or access logs. Manage the endpoint URL and the key together as a set for each environment. Do not tell production from sandbox by the key prefix alone.

## Issuing and revoking payment API keys

Payment API keys are issued and revoked **per store** in the merchant console. In the merchant console menu, open the target online store from 「お店と QR コード」 (Store & QR code), then on the 「組み込みの準備」 (Integration setup) tab, under 「お支払いを作るための鍵」 (Keys for creating payments), press 「API キーを発行」 (Issue API key). The label is optional, up to 64 characters.

- The format is `stblpay_` followed by 43 characters of base64url.
- **The plaintext is shown only once, when you issue the key.** The server stores only a SHA-256 hash, so it cannot be shown again after you close the screen. Store it only on the merchant's server. If you could not save it, revoke that key and issue a new one.
- The list shows a masked key (only the beginning and end), the issue date and time, and the last-used date and time.
- **Each store can have up to 10 active keys.** Trying to issue more returns 409 `store/api_key_limit_reached`. Revoke unused keys before issuing a new one.
- Revoke a key from 「失効」 (Revoke) in the list. **Revocation takes effect immediately and cannot be undone.** Requests from servers using that key are rejected.
- You can issue and revoke API keys while the store is suspended with 「停止する」 (Suspend). While suspended, the store does not accept new payments.
- While STBLpay has suspended the merchant, you cannot issue or revoke API keys ([Merchant suspension](/lifecycle/edge-cases#merchant-suspension)).

A store can hold multiple keys so you can rotate keys without stopping payments. For example, rotate in this order:

1. Issue a new key.
2. Switch the server to the new key.
3. Confirm that the old key's last-used time is no longer updated, then revoke the old key.

If a store could hold only one key, you could not create payments during rotation. If you use a separate key for each server, a leak from one server only requires revoking that one key, and the other servers keep working.

## Rotation and compromise

Stop a leaked key with 「失効」 (Revoke), issue a new key, and replace the key on your servers. Check the usage (last-used time) and the affected orders. Issuing and revoking are actions by the merchant themselves, logged in to the merchant console. They cannot be done with a payment API key.

Manage the Webhook signing secret in the merchant console menu: open the target online store from 「お店と QR コード」 (Store & QR code), then on the 「組み込みの準備」 (Integration setup) tab, under 「お支払い完了のお知らせ先」 (Payment completion notification endpoint). It is shown only once, at first setup, and does not change when you change the URL. If you choose 「署名鍵を作り直す」 (Regenerate signing secret), both the old and new secrets are valid for 24 hours, and during that time the header contains two `v1` values. If you suspect the key is compromised, do not regenerate it. Instead, use 「webhook を解除」 (Remove webhook) and set it up again. For the procedure, see [Signature verification](/webhooks/signature#if-the-key-is-compromised).
