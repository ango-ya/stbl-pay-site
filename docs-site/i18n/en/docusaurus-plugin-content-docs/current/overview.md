---
id: overview
title: What is STBLpay
sidebar_label: Overview
sidebar_position: 1
slug: /
---

<div className="brand-band">
  <img src={require('@site/static/img/logo-wordmark-stblpay-black.png').default} alt="STBLpay" />
  <span>A merchant guide to adding a checkout to your e-commerce site: buyers pay in yen, you receive stablecoin</span>
</div>

# What is STBLpay

This guide is for merchant developers and operations staff who integrate STBLpay into an e-commerce site.

STBLpay is a service that adds yen payment by bank transfer and JPYC receipt to an e-commerce site. The buyer approves the payment with a passkey on a dedicated checkout page. If the buyer's JPYC balance is sufficient, the payment is made from that balance.

## Merchants do three things

1. **Create a payment on your server.** Confirm the order, calculate the amount on your server, and create a payment through the API. Example: create a payment for order `ord_0001` for 4,980 yen. See [Create a payment](/server/create-payment).
2. **Send the buyer to the returned `checkoutUrl`.** Example: when the buyer presses the "Pay" button, navigate the buyer's browser to `checkoutUrl`. See [Start a payment](/client/start-payment).
3. **Receive the result on your server.** Confirm the result with a Webhook (verify the signature) or a [status lookup](/server/retrieve-payment), then update the order. Setting up a Webhook is optional. Example: once you confirm success, mark the order as "paid" and deliver the goods exactly once. See [Completion check](/lifecycle/completion) and [Webhooks](/webhooks/events).

STBLpay and the buyer handle everything else, as follows.

| Who | What they do | Example |
|---|---|---|
| STBLpay | Provides the checkout page | The screen where the buyer approves the payment with a passkey |
| STBLpay | Provides the merchant console | Issuing API keys, configuring Webhooks, approving refunds |
| Buyer | Applies for JPYC issuance | On the JPYC EX screen, the buyer applies for JPYC issuance and pays in yen by bank transfer |

## Scope and basis of this site

| Subject | How this site treats it |
|---|---|
| Payment API, statuses, Webhooks | Integration details covered in this guide |
| Refunds | Only through the merchant console, where the owner approves with a passkey. There is no refund API that a merchant server can call |
| Sandbox | In preparation ([Sandbox](/testing/sandbox)) |
| Managing multiple accounts, WooCommerce plugin | Planned after the first release ([Roadmap](/support/roadmap)) |

Availability and known limitations are summarized in [Scope and limitations](/support/limitations).

## Read these first

1. [Payment flow](/getting-started/payment-flow), [Money flow](/getting-started/money-flow), [Division of responsibilities](/getting-started/responsibilities)
2. [Prerequisites](/getting-started/prerequisites) and [Quick Start](/getting-started/quickstart)
3. [Completion check](/lifecycle/completion) and [Webhooks](/webhooks/events)

For refunds, see [Scope of refunds](/refunds/overview).
