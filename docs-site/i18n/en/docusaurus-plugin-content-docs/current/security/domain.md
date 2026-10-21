---
title: Domain registration
sidebar_label: Domain registration
sidebar_position: 4
---

# Domain registration

STBLpay uses the domain you register in the merchant console to validate `returnUrl`, the destination after payment.

Pass the browser the `checkoutUrl` returned when you create the payment, and move the whole screen to the checkout page ([top-level navigation](/reference/glossary)). Do not build the destination yourself from the payment ID.

## Requirements for `returnUrl` {/* #returnurl-requirements */}

`returnUrl` is the URL of the page the buyer returns to after payment. Specify a page that meets all of these conditions:

- It starts with `https://`.
- It has no port number and no [userinfo](/reference/glossary) (`user:pass@`).
- Its host name exactly matches the domain registered in the merchant console (case-insensitive; subdomains are not allowed).

You cannot use `localhost`.

Examples when the registered domain is `shop.example.com`:

- OK: `https://shop.example.com/orders/123/return`
- NG: `http://shop.example.com/…` (not `https`)
- NG: `https://other.example.com/…` (a different domain)
- NG: `https://shop.example.com:8443/…` (has a port)
- NG: `https://www.shop.example.com/…` (subdomain)
- NG: `https://user:pass@shop.example.com/…` (has userinfo)
- NG: `https://localhost/…`

The STBLpay checkout page is what sends the buyer to `returnUrl`. Without these requirements, someone could create a payment whose return destination is a fake site's URL. To the buyer, the destination is "where STBLpay's screen sent me," so they would trust even a fake site ([open redirect](/reference/glossary)). Limiting the return destination to the registered domain prevents this.

## Registering a domain

**You must register a domain to accept payments from an e-commerce site.** If you call `POST /payment_intents` without registering one, you get 409 `merchant/domain_required`.

You register, change, or remove the domain in the merchant console. From the menu, open the target online store from Store & QR code (お店と QR コード), then use the domain section on the Integration setup (組み込みの準備) tab. The domain is set per merchant, so you see the same value whichever online store you open it from.

**Register**

1. Enter only the host name in Domain (host name) (ドメイン（ホスト名）). Do not include `https://`, a path, or a port number (example: `shop.example.com`).
2. Click Register (登録する).

**Change**

1. Enter the new host name in New domain (host name) (新しいドメイン（ホスト名）).
2. Click Change (変更する), then click Change (変更する) again in the confirmation dialog.

Changing the domain revokes the proof of ownership. To prove ownership again, place and verify a new token. The return destinations of payments you already created do not change. STBLpay checks new e-commerce payments against the changed domain.

**Remove**

1. Click Remove registration (登録を解除).
2. Click Remove (解除する) in the confirmation dialog.

After removal, you cannot create new payments from the e-commerce site, and the proof of ownership is also revoked. The return destinations of payments you already created do not change.

You cannot register an IP address or a domain shared by multiple sites (the public suffix itself). Enter your own site's host name.

## Proof of ownership (optional)

Proof of ownership is optional. Under Proof of ownership (optional) (所有の証明（任意）) for the registered domain, STBLpay shows a token. Place it using **any one** of the following three methods, then click Verify the placed value (設置した値を確認する).

1. A DNS TXT record
2. A well-known file (STBLpay checks the registered host name itself over `https` and does not follow redirects)
3. An HTML meta tag (inside `<head>`; STBLpay does not check the body)

When the proof succeeds, the checkout screen shows a verified indicator. **This indicator shows that ownership of the domain has been proven. It does not mean STBLpay has reviewed or endorsed the merchant, and it is not a guarantee of the safety of the payment.** STBLpay does not show a negative indicator for merchants that have not proven ownership.

The proof is not finished once it succeeds. STBLpay re-verifies it periodically (every 24 hours). **The periodic re-verification checks only the method that last succeeded.** If you change the placement method (for example, from DNS to a meta tag), place the value with the new method and click Verify the placed value (設置した値を確認する) again. If you remove the previous placement without clicking it again, STBLpay withdraws the proof at the next re-verification.

- If the placed value does not match the token (or cannot be found), the verified indicator is withdrawn immediately.
- The indicator is also withdrawn immediately, on a single occurrence, in these cases: the domain resolves to a non-public address, such as an internal one; or the well-known file check returns a 4xx (except 408 and 429) or a redirect.
- The indicator is also withdrawn when the site or DNS cannot be reached (5xx, 408, 429, connection failure, timeout) three times in a row. One or two failures from a temporary outage do not withdraw it.
- Re-verification continues after withdrawal, and the verified indicator returns when verification succeeds again.
- If you change or remove the domain, the previous proof is not restored.

Verify the placed value (設置した値を確認する) is limited to 5 times per minute (`common/rate_limited`, 429). If you exceed the limit, wait about a minute. Periodic re-verification does not count toward this limit.

You are responsible for authorizing the return page. Do not decide that a payment succeeded just because the buyer came back to the registered domain.
