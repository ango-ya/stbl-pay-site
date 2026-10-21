---
title: Division of responsibilities
sidebar_label: Division of responsibilities
sidebar_position: 2
---

# Division of responsibilities

## The merchant's browser and server

- **Fixing the amount and creating the payment**: do this on the merchant server, after authorizing the order
- **API keys and the Webhook signing secret**: store them only on the server
- **Deciding whether to provide the goods**: base the decision on a verified notification or a server-to-server lookup
- **Query of the return URL**: use it only as a hint for display. Do not use it to finalize an order
- **Viewing your own orders**: authorize with your own login and an ownership check

The payment ID is not a secret. Do not build an endpoint that returns order contents to anyone who knows the ID.

## The checkout page

The checkout page is a separate [origin](/reference/glossary) from the merchant site. It is [responsible](/reference/glossary) for passkey authentication and for building and signing the payment operation. The merchant site navigates to `checkoutUrl` with a [top-level navigation](/reference/glossary). Do not embed the checkout page in an iframe, popup, or modal.

The API's `returnUrl` is also included in the status lookup, so do not put session tokens, secret coupons, or similar values in it.

## Logs

Do not record `x-stbl-api-key`, the Webhook signing secret, or private keys. By design, the issuer's reasons for a transaction decision are not carried into the merchant-facing `failedReason` or into logs. For investigations, use only the identifiers you need, such as the payment ID, order ID, and time.
