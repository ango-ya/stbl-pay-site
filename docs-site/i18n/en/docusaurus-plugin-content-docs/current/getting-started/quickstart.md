---
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 4
---

# Quick Start

These are the minimal steps to check payment creation, navigation, and status lookup against an endpoint that behaves as this guide describes. Prepare the [connection information](/getting-started/prerequisites) first. To try things out, you can use the [Sandbox](/testing/sandbox).

## 1. Create a payment from the server

The following example runs on the server side. Set `STBL_PAY_BACKEND` and `STBL_PAY_API_KEY` to the values for your target environment. Replace the example `returnUrl` with a URL on your registered domain (for requirements, see [Domain registration](/security/domain#returnurl-requirements)).

```bash
curl --fail-with-body "$STBL_PAY_BACKEND/payment_intents" \
  -H "x-stbl-api-key: $STBL_PAY_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"amountJpy":"4980","orderId":"ord_0001","returnUrl":"https://shop.example.com/orders/ord_0001/return"}'
```

Save the mapping between the order and `paymentIntentId`, check the `status` in the response, and then pass the `checkoutUrl` to the browser. When you retry for the same order, use the same `orderId`. If a retry returns an existing payment that is already terminal, do not send the browser to its `checkoutUrl`. If the status is `settled`, the payment is already complete. If it is `nonce_conflict`, the outcome is not determined: stop automatic shipping and automatic re-billing, ask the [contact](/support/troubleshooting#contact) to investigate with the payment ID, and do not create a new payment until you receive the result of the investigation in reply to your inquiry (see [The transfer result cannot be determined](/lifecycle/edge-cases#nonce-conflict)). If it is `failed`, `expired` or `canceled`, check how the order should be handled, then create a new payment with a new `orderId` (see [Idempotency](/server/create-payment#idempotency)). For the other fields in the response, see the [REST reference](/reference/rest).

## 2. Navigate the browser

```js
// checkoutUrl is the value your server returned from the STBLpay creation response.
window.location.assign(checkoutUrl);
```

Do not embed the API key in HTML or JavaScript. Do not put the dedicated checkout page in an iframe or popup. Navigate the whole page.

## 3. Check the status on the server

Set the ID you saved at creation in `PAYMENT_INTENT_ID` and look it up. This API does not require authentication.

```bash
curl --fail-with-body "$STBL_PAY_BACKEND/payment_status/$PAYMENT_INTENT_ID"
```

If `status` is `settled`, the payment has succeeded. `signed` and `deposit_confirmed` are in progress. Do not treat a failed lookup as a failed payment.

## 4. Connect to order processing

This example alone does not complete goods delivery. Implement the following.

- Authentication and authorization of your own orders, amount calculation on the server, CSRF protection
- If you use Webhooks (optional, recommended): [Webhook signature verification](/webhooks/signature) and [persistence and deduplication](/webhooks/idempotency). If you do not, confirm `settled` with a status lookup before finalizing the order
- [Completion check on the server](/lifecycle/completion) and delivering goods exactly once
- Periodic lookups for missed notifications and handling of [abnormal cases](/lifecycle/edge-cases)

Do not use the query on the return URL to decide that an order is paid.
