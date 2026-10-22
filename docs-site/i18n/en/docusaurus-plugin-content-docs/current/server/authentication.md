---
title: Authentication
sidebar_label: Authentication
sidebar_position: 1
---

# Authentication

Call the create payment API from the merchant server and send the API key in the following header.

```http
x-stbl-api-key: <API key issued for each environment>
```

An API key is issued for each store. Its format is `stblpay_` followed by 43 base64url characters. For the issuance and revocation procedure, and the limit of 10 active keys per store, see [Managing API keys](/security/api-keys).

`Authorization: Bearer` is not how to send an STBLpay API key. If the sandbox entry point has Basic authentication or similar, configure it separately from API authentication.

`GET /payment_status/:paymentIntentId` requires no authentication. Do not reuse the payment ID you obtained as authorization to view your own orders.

## Handling keys and errors

Store the API key in your server's secret management system, and do not expose it in the browser, HTML, repositories, or access logs. Manage the URL and the key of each environment as a pair.

On failure, read `{ code, details? }` and handle it according to the `code` in [Errors](/reference/rest#errors). Do not retry authentication or configuration errors without limit. If the result of a create payment request is unknown, use the same `orderId`.

Next, see [Create a payment](/server/create-payment).
