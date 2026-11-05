---
title: Domain registration
description: "Explains the role of the domains registered in the merchant console, which are used to validate the returnUrl, and how the two domain settings differ."
sidebar_label: Domain registration
sidebar_position: 4
---

# Domain registration

STBLpay uses the domain you register in the merchant console to validate `returnUrl`, the destination after payment.

There are two domain settings, and they are treated differently.

| Setting | Status | Used for |
|---|---|---|
| [Registering a domain](#registering-a-domain) | **Required for e-commerce payments** | Checking `returnUrl`. Without it, you cannot create payments |
| [Proof of ownership](#proof-of-ownership) | Optional | Showing a verified indicator on the checkout screen |

Registering is enough to start accepting payments. Proof of ownership is an additional setting that shows buyers that you control the registered domain, and you can set it up at any time.

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

You are responsible for authorizing the return page. Do not decide that a payment succeeded just because the buyer came back to the registered domain.

## Registering a domain {/* #registering-a-domain */}

**You must register a domain to accept payments from an e-commerce site.** If you call `POST /payment_intents` without registering one, you get 409 `merchant/domain_required`.

You register, change, or remove the domain in the merchant console. From the menu, open the target online store from Store & QR code (お店と QR コード), then use the 2. Register your site's domain (2. サイトのドメインを登録) section on the Integration setup (組み込みの準備) tab. The domain is set per merchant, so you see the same value whichever online store you open it from.

**Register**

1. Enter only the host name in Domain (host name) (ドメイン（ホスト名）). Do not include `https://`, a path, or a port number (example: `shop.example.com`).
2. Click Register (登録する).

STBLpay does not access your site when you register a domain. You can register a test site even if it is protected by Basic authentication or other access restrictions.

**Change**

1. Enter the new host name in New domain (host name) (新しいドメイン（ホスト名）).
2. Click Change (変更する), then click Change (変更する) again in the confirmation dialog.

Changing the domain revokes the proof of ownership. To prove ownership again, place and verify a new token. The return destinations of payments you already created do not change. STBLpay checks new e-commerce payments against the changed domain.

**Remove**

1. Click Remove registration (登録を解除).
2. Click Remove (解除する) in the confirmation dialog.

After removal, you cannot create new payments from the e-commerce site, and the proof of ownership is also revoked. The return destinations of payments you already created do not change.

You cannot register an IP address or a domain shared by multiple sites (the public suffix itself). Enter your own site's host name.

## Proof of ownership (optional) {/* #proof-of-ownership */}

Proof of ownership is optional. On the same Integration setup (組み込みの準備) tab, open Place and verify the value (値の設置と確認（担当の方へ）) in the 5. Proof of domain ownership (5. ドメインの所有の証明) section to see the token. Place it using **any one** of the following three methods, then click Verify the placed value (設置した値を確認する).

| Method | Where to place it | Value |
|---|---|---|
| DNS TXT record | Record name `_stbl-pay-verification.<hostname>` | The token |
| Well-known file | `https://<hostname>/.well-known/stbl-pay-merchant.txt` | Only the token in the body |
| HTML meta tag | Inside `<head>` of `https://<hostname>/` (the body is not checked) | `<meta name="stbl-pay-verification" content="<token>">` |

The token differs for each merchant, so check it in the merchant console. For the well-known file and the meta tag, STBLpay reads the registered host name itself over `https`. It does not follow redirects.

**If your site is private behind Basic authentication or access restrictions, use the DNS TXT record.** The well-known file and the meta tag can only be checked if they can be read without authentication (a 401 or 403 withdraws the proof immediately). Periodic re-verification reads them the same way, so removing authentication only while you verify does not help: once you restore it, the proof is withdrawn when a re-verification gets a 401 or 403.

This section cannot be used until you register a domain. The result appears just below the collapsible section that contains the Verify the placed value (設置した値を確認する) button. On success, "Proof of ownership succeeded" (所有の証明が成立しました) appears, and "Ownership proven" (所有を証明済み) appears next to the registered domain. On failure, the reason appears there.

When the proof succeeds, the checkout screen shows a verified indicator. **This indicator shows that ownership of the domain has been proven. It does not mean STBLpay has reviewed or endorsed the merchant, and it is not a guarantee of the safety of the payment.** STBLpay does not show a negative indicator for merchants that have not proven ownership.

The proof is not finished once it succeeds. STBLpay re-verifies it periodically (every 24 hours). **The periodic re-verification checks only the method that last succeeded.** If you change the placement method (for example, from DNS to a meta tag), place the value with the new method and click Verify the placed value (設置した値を確認する) again. If you remove the previous placement without clicking it again, STBLpay withdraws the proof at the next re-verification.

- If the placed value does not match the token (or cannot be found), the verified indicator is withdrawn immediately.
- The indicator is also withdrawn immediately, on a single occurrence, in these cases: the domain resolves to a non-public address, such as an internal one; or the well-known file or meta tag check returns a 4xx (except 408 and 429, including 401 and 403) or a redirect.
- The indicator is also withdrawn when the site or DNS cannot be reached (5xx, 408, 429, connection failure, timeout, certificate verification failure) three times in a row. One or two failures from a temporary outage do not withdraw it.
- Re-verification continues after withdrawal, and the verified indicator returns when verification succeeds again.
- If you change or remove the domain, the previous proof is not restored.

Verify the placed value (設置した値を確認する) is limited to 5 times per minute (`common/rate_limited`, 429). If you exceed the limit, wait about a minute. Periodic re-verification does not count toward this limit.

### When verification fails {/* #when-verification-fails */}

To check the well-known file and the meta tag, STBLpay's servers connect to the registered host name over `https` from the public internet. Depending on your site's settings, these requests may be blocked. This is especially common on development and test sites.

| Site condition | What to do |
|---|---|
| Protected by a password such as Basic authentication, or restricted by IP address | Prove ownership with a DNS TXT record (lifting the restriction only while you verify does not help, because periodic re-verification withdraws the proof) |
| Bot protection in a WAF or CDN blocks outside access | Prove ownership with a DNS TXT record, or configure the bot protection not to block requests from STBLpay |
| The SSL certificate fails validation (for example, it is self-signed or expired) | Use a valid certificate issued by a public certificate authority, or prove ownership with a DNS TXT record |
| Redirects to another URL (for example, to a `www` host name or a login page) | Serve the response from the registered host name without redirecting, or prove ownership with a DNS TXT record |
| The host name points to a non-public address, such as an internal one | Point it to a publicly reachable server, or prove ownership with a DNS TXT record |

**STBLpay checks the DNS TXT record without accessing your site's server.** It works in any of the conditions above.

In these conditions, the screen may show "None of them were found" (いずれも見つかりませんでした) or "Could not connect to the site or DNS" (サイトまたは DNS に接続できませんでした). If you placed the value in the right place and verification still fails, check whether one of the conditions above applies.
