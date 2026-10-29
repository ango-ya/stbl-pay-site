---
title: Prerequisites
sidebar_label: Prerequisites
sidebar_position: 3
---

# Prerequisites

Term definitions are in the [Glossary](/reference/glossary).

This guide targets an environment that behaves as the guide describes. Before you connect, ask the [contact](/support/troubleshooting#contact) which version of that environment you have and which features are available.

## Connection information

| Item | Purpose |
|---|---|
| API base URL | Server-to-server payment creation and status lookup |
| Merchant API key | The `x-stbl-api-key` header for payment creation. Issued per store in the merchant console |
| Merchant's registered domain (host name, for example `shop.example.com`; see [Domain registration](/security/domain)) | Required to create an EC payment (409 `merchant/domain_required` if not registered). Also used to match the host name of `returnUrl` |
| Webhook endpoint and signing secret (optional, recommended) | Receiving result notifications on the server. If you do not use Webhooks, confirm `settled` with a status lookup before finalizing the order |

Do not pass the API key to the browser. The environment for merchants to try is in preparation ([Sandbox](/testing/sandbox)). Get the checkout page URL from the creation response.

## Merchant-side preparation

First, create an online store. In the merchant console menu, open Store & QR code (お店と QR コード), click Create store (お店をつくる), enter the store name (up to 128 characters), and choose Online store (ネットショップ) as the store type (お店の種類). The API key, domain, and Webhook settings are only on the Integration setup (組み込みの準備) tab of an online store. They do not appear on an In-store QR (店頭 QR) store. You cannot change the store type later. If you also take in-store QR payments, create a second store.

1. Authenticate and authorize orders, and calculate the amount on the server.
2. Prepare a database that stores the order-to-payment ID mapping.
3. Prepare a page to return to after payment (for URL requirements and examples, see [Domain registration](/security/domain#returnurl-requirements)).
4. If you use Webhooks, make sure your HTTPS Webhook endpoint can keep the [raw body](/reference/glossary#notifications) (the body exactly as received). Use a final URL that accepts `POST` directly. The URL must use HTTPS, must not contain a username or password ([userinfo](/reference/glossary#screen-navigation-and-domains)), and must not resolve to an internal address. Redirects (`3xx`) are not followed ([Endpoint URL requirements](/webhooks/retry#endpoint-url-requirements)).
5. Implement periodic [reconciliation](/reference/glossary#confirmation-and-reconciliation) of orders. If you use Webhooks, also implement signature verification, persistence of received events, and deduplication. If you do not, confirm `settled` with a status lookup before finalizing the order.
