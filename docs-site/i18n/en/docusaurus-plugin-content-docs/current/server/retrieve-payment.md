---
title: Retrieve payment status
sidebar_label: Retrieve payment status
sidebar_position: 3
---

# Retrieve payment status

From the merchant server, [look up](/reference/glossary) the current status using the saved `paymentIntentId`. **API authentication is not required.**

```js
const response = await fetch(
  `${process.env.STBL_PAY_BACKEND}/payment_status/${encodeURIComponent(paymentIntentId)}`,
);
if (!response.ok) throw new Error(`Status lookup failed: HTTP ${response.status}`);
const payment = await response.json();
```

Your own order display API needs login and an order ownership check. Use the ID saved on the order, not an arbitrary payment ID passed by the browser.

## Handling the response

The response fields are summarized in the [REST reference](/reference/rest#retrieve-payment). For the definition of each field, see `PaymentStatusView` in the [OpenAPI specification](pathname:///openapi.yaml). Amounts and fees are not included in this response. Do not treat a lookup failure or timeout as a `failed` payment.

| Status | Order-side handling |
|---|---|
| `settled` | Confirm the match with the order, and mark it as paid exactly once |
| `canceled` / `expired` / `failed` | End the order that has not been fulfilled, following your business rules |
| `nonce_conflict` | The outcome cannot be determined, so stop automatic shipping and automatic re-billing, and ask the [contact](/support/troubleshooting#contact) to investigate with the payment ID |
| The other 6 statuses | The payment is in progress; continue looking it up |

Use this for a confirming lookup when you receive a Webhook, and for periodic reconciliation of unconfirmed orders whose notification you missed. Keep checking even if the browser does not return.

See also [Completion criteria](/lifecycle/completion) and [Meaning of statuses](/lifecycle/statuses).
