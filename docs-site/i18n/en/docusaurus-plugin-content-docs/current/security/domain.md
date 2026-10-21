---
title: Domain registration
sidebar_label: Domain registration
sidebar_position: 4
---

# Domain registration

The domain you register in the merchant console is used to validate `returnUrl`, the destination after payment.

Pass the browser the `checkoutUrl` returned when you create the payment, and move the whole screen to the checkout page ([top-level navigation](/reference/glossary)). Do not build the destination yourself from the payment ID.

## Requirements for `returnUrl` {/* #returnurl-requirements */}

`returnUrl` is the URL of the page the buyer returns to after payment. Specify a page that starts with `https://`, has no port number and no [userinfo](/reference/glossary) (`user:pass@`), and whose host name exactly matches the domain registered in the merchant console (case-insensitive; subdomains are not allowed). `localhost` cannot be used.

Examples when the registered domain is `shop.example.com`:

- OK: `https://shop.example.com/orders/123/return`
- NG: `http://shop.example.com/…` (not `https`)
- NG: `https://other.example.com/…` (a different domain)
- NG: `https://shop.example.com:8443/…` (has a port)
- NG: `https://www.shop.example.com/…` (subdomain)
- NG: `https://user:pass@shop.example.com/…` (has userinfo)
- NG: `https://localhost/…`

It is the STBLpay checkout page that sends the buyer to `returnUrl`. Without these requirements, someone could create a payment whose return destination is a fake site's URL. To the buyer, the destination is "where STBLpay's screen sent me," so they would trust even a fake site ([open redirect](/reference/glossary)). Limiting the return destination to the registered domain prevents this.

## Registering a domain

**Registering a domain is required to accept payments from an e-commerce site.** If you call `POST /payment_intents` without registering one, you get 409 `merchant/domain_required`.

Register, change, or remove the domain in the merchant console. From the menu, open the target online store from 「お店と QR コード」 (Store & QR code), then use the domain section on the 「組み込みの準備」 (Integration setup) tab. The domain is per merchant, so you see the same value whichever online store you open it from.

**Register**

1. Enter only the host name in 「ドメイン（ホスト名）」 (Domain (host name)). Do not include `https://`, a path, or a port number (example: `shop.example.com`).
2. Press 「登録する」 (Register).

**Change**

1. Enter the new host name in 「新しいドメイン（ホスト名）」 (New domain (host name)).
2. Press 「変更する」 (Change), and press 「変更する」 (Change) again in the confirmation dialog.

Changing the domain revokes the proof of ownership. To prove ownership again, you need to place and verify a new token. The return destinations of payments already created do not change, and new e-commerce payments are checked against the changed domain.

**Remove**

1. Press 「登録を解除」 (Remove registration).
2. Press 「解除する」 (Remove) in the confirmation dialog.

After removal, you cannot create new payments from the e-commerce site, and the proof of ownership is also revoked. The return destinations of payments already created do not change.

You cannot register an IP address or a domain shared by multiple sites (the public suffix itself). Enter your own site's host name.

## Proof of ownership (optional)

Proof of ownership is optional. Place the token shown under 「所有の証明（任意）」 (Proof of ownership (optional)) for the registered domain using **any one** of the following three methods, then press 「設置した値を確認する」 (Verify the placed value).

1. A DNS TXT record
2. A well-known file (STBLpay checks the registered host name itself over `https`; redirects are not followed)
3. An HTML meta tag (inside `<head>`; it is not checked in the body)

When the proof succeeds, the checkout screen shows a verified indicator. **This indicator shows that ownership of the domain has been proven. It is not an indication that STBLpay has reviewed or endorsed the merchant, and it is not a guarantee of the safety of the payment.** STBLpay does not show a negative indicator for merchants that have not proven ownership.

The proof is not finished once it succeeds. It is re-verified periodically (every 24 hours). **The periodic re-verification checks only the method that last succeeded.** When you change the placement method (for example, from DNS to a meta tag), place the value with the new method and press 「設置した値を確認する」 (Verify the placed value) again. If you remove the placement of the previous method without pressing it again, the proof is withdrawn at the next re-verification.

- If the placed value does not match the token (or cannot be found), the verified indicator is withdrawn immediately.
- In the following cases too, it is withdrawn immediately on a single occurrence: the domain resolves to a non-public address, such as an internal one; or the well-known file check returns a 4xx (except 408 and 429) or a redirect.
- It is also withdrawn when the site or DNS cannot be reached (5xx, 408, 429, connection failure, timeout) three times in a row. A temporary outage of one or two checks does not withdraw it.
- Re-verification continues after withdrawal, and the verified indicator returns when verification succeeds again.
- If you change or remove the domain, the previous proof is not restored.

「設置した値を確認する」 (Verify the placed value) is limited to 5 times per minute (`common/rate_limited`, 429). If you exceed it, wait about a minute. Periodic re-verification does not count toward this limit.

Authorization of the return page is your responsibility. Do not decide that a payment succeeded just because the buyer came back to the registered domain.
