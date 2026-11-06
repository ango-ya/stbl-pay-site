---
title: Quick Start
description: "The shortest path to confirm payment creation, redirect, and status lookup. Prepare your connection details and try it in the Sandbox."
sidebar_label: Quick Start
sidebar_position: 4
---

# Quick Start

These steps take you from registering a merchant in the [Sandbox](/testing/sandbox) and issuing an API key to creating your first payment. Production uses the same steps; you only swap the URLs and keys for the production ones (see [Environments and URLs](/#environments-and-urls)).

## 1. Register a merchant in the Sandbox

Register with a passkey on the merchant console's [registration page](https://merchant.sandbox.stbl-pay.com/register). The referral code (紹介コード) is optional.

## 2. Create an online store

In the menu, open Store & QR code (お店と QR コード), click Create store (お店をつくる), and choose Online store (ネットショップ) as the store type. The API key, domain, and Webhook settings are on this store's Integration setup (組み込みの準備) tab. You cannot change the store type later (see [Prerequisites](/getting-started/prerequisites#merchant-side-preparation)).

## 3. Issue an API key

On the Integration setup tab, under Key for creating payments (お支払いを作るための鍵), click Issue API key (API キーを発行). **The key is shown only once, when it is issued.** Save it in your server's environment variables right away.

```bash
export STBL_PAY_BACKEND=https://api.sandbox.stbl-pay.com
export STBL_PAY_API_KEY=stblpay_...   # the key you issued
```

Keep the key out of the browser and Git, and use it only on your server (see [Managing API keys](/security/api-keys)).

## 4. Register your domain

In the domain section of the same tab, register the host name of the page buyers return to after payment (for example, `shop.example.com`). **You cannot create payments until a domain is registered** (409 `merchant/domain_required`). To try this from a local environment, see [Multiple environments and local development](/testing/sandbox#multiple-environments).

## 5. Create a payment from the server

Replace `returnUrl` with a URL on your registered domain (see [requirements](/security/domain#returnurl-requirements)).

```bash
curl --fail-with-body "$STBL_PAY_BACKEND/payment_intents" \
  -H "x-stbl-api-key: $STBL_PAY_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"amountJpy":"4980","orderId":"ord_0001","returnUrl":"https://shop.example.com/orders/ord_0001/return"}'
```

Save the mapping between the order and `paymentIntentId`, check the `status` in the response, and then pass the `checkoutUrl` to the browser. When you resend the request, use the same `orderId`. If a retry returns an existing payment that is already terminal, do not send the browser to its `checkoutUrl`. If the status is `settled`, the payment is already complete. If it is `nonce_conflict`, the outcome is not determined: stop automatic shipping and automatic re-billing, ask the [contact](/support/troubleshooting#contact) to investigate with the payment ID, and do not create a new payment until you receive the result of the investigation in reply to your inquiry (see [The transfer result cannot be determined](/lifecycle/edge-cases#nonce-conflict)). If it is `failed`, `expired` or `canceled`, check how the order should be handled, then create a new payment with a new `orderId` (see [Idempotency](/server/create-payment#idempotency)). For the other fields in the response, see the [REST reference](/reference/rest).

## 6. Send the browser to the checkout page

```js
// checkoutUrl is the value your server returned from the STBLpay creation response.
window.location.assign(checkoutUrl);
```

Do not embed the API key in HTML or JavaScript. Do not put the dedicated checkout page in an iframe or popup. Navigate the whole page. On the Sandbox checkout page, approve the payment with a passkey as the buyer.

## 7. Check the status on the server

Set the ID you saved at creation in `PAYMENT_INTENT_ID` and look it up. This API does not require authentication.

```bash
curl --fail-with-body "$STBL_PAY_BACKEND/payment_status/$PAYMENT_INTENT_ID"
```

If `status` is `settled`, the payment has succeeded. `signed` and `deposit_confirmed` are in progress. Do not treat a failed lookup as a failed payment.

## 8. Set up a Webhook

E-commerce sites normally set this up to receive payment results. On the Integration setup tab, set your endpoint URL under Payment completion notifications (お支払い完了のお知らせ先). The signing secret is shown only once, when you first set it up, so save it on your server just like the API key. You can check that you receive notifications with Test send (テスト送信) (see [Webhooks](/webhooks/events) and [Signature verification](/webhooks/signature)).

## 9. Connect to order processing

This example alone does not complete goods delivery. Implement the following and check it with the [Test scenarios](/testing/scenarios).

- Authentication and authorization of your own orders, amount calculation on the server, CSRF protection
- Webhook [signature verification](/webhooks/signature) and [persistence and deduplication](/webhooks/idempotency). If you have a reason not to use Webhooks, confirm `settled` with a status lookup before finalizing the order
- [Completion check on the server](/lifecycle/completion) and delivering goods exactly once
- Periodic lookups for missed notifications and handling of [abnormal cases](/lifecycle/edge-cases)

Do not use the query on the return URL to decide that an order is paid.

## 10. Switch to production

Repeat steps 1–4 (and 8) in the production merchant console, then set `STBL_PAY_BACKEND` and `STBL_PAY_API_KEY` to the production values. Keys, domains, and Webhooks are set up separately for each environment. The production URLs will be announced in [Environments and URLs](/#environments-and-urls) after launch.
