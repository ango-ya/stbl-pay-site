---
title: Prerequisites
sidebar_label: Prerequisites
sidebar_position: 3
---

# Prerequisites

Term definitions are in the [Glossary](/reference/glossary).

This guide targets an environment that behaves as this guide describes. Before connecting, ask the [contact](/support/troubleshooting#contact) about the version of that environment and the features available.

## Connection information

| Item | Purpose |
|---|---|
| API base URL | Server-to-server payment creation and status lookup |
| Merchant API key | The `x-stbl-api-key` header for payment creation. Issued per store in the merchant console |
| Merchant's registered domain ([origin](/reference/glossary)) | Validating `returnUrl` |
| Webhook endpoint and signing secret | Receiving result notifications on the server |

Do not pass the API key to the browser. The environment for merchants to try is in preparation ([Sandbox](/testing/sandbox)). Get the checkout page URL from the creation response.

## Merchant-side preparation

1. Authenticate and authorize orders, and calculate the amount on the server.
2. Prepare a database that stores the order-to-payment ID mapping.
3. Prepare a page to return to after payment (for URL requirements and examples, see [Domain registration](/security/domain#returnurl-requirements)).
4. Make sure the HTTPS Webhook endpoint can keep the [raw body](/reference/glossary) (the body exactly as received). Use a final URL that accepts `POST` directly. HTTPS only, no username or password ([userinfo](/reference/glossary)) in the URL, no resolution to internal addresses, and redirects (`3xx`) are not followed ([Endpoint URL requirements](/webhooks/retry#endpoint-url-requirements)).
5. Implement signature verification, persistence of received events, deduplication, and periodic [reconciliation](/reference/glossary) of orders.
