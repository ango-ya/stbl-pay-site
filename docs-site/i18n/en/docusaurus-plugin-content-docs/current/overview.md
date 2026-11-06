---
id: overview
title: What is STBLpay
description: "A merchant guide to adding STBLpay, a stablecoin payment service where customers pay in yen and merchants receive JPYC, to an EC site, with how it works."
sidebar_label: Overview
sidebar_position: 1
slug: /
---

<div className="brand-band">
  <img src={require('@site/static/img/logo-wordmark-stblpay-black.png').default} alt="STBLpay" />
  <span>A merchant guide to adding checkout to your e-commerce site: buyers pay in yen, you receive stablecoin</span>
</div>

# What is STBLpay

This guide is for merchant developers and operations staff who integrate STBLpay into an e-commerce site.

STBLpay lets an e-commerce site accept yen payments by bank transfer and receive JPYC. The buyer approves the payment with a passkey on a dedicated checkout page. If the buyer has enough JPYC, the payment comes from that balance.

## What merchants do

1. **Create a payment on your server.** Confirm the order, calculate the amount on your server, and create a payment through the API. Example: create a payment for order `ord_0001` for 4,980 yen. See [Create a payment](/server/create-payment).
2. **Send the buyer to the returned `checkoutUrl`.** Example: when the buyer presses the "Pay" button, navigate the buyer's browser to `checkoutUrl`. See [Start a payment](/client/start-payment).
3. **Receive the result on your server.** Receive the result with a Webhook (verify the signature), then update the order. E-commerce sites normally use Webhooks. If you have a reason not to, confirm the result with a [status lookup](/server/retrieve-payment). Example: once you confirm success, mark the order as "paid" and deliver the goods exactly once. See [Completion check](/lifecycle/completion) and [Webhooks](/webhooks/events).

STBLpay and the buyer handle everything else:

| Who | What they do | Example |
|---|---|---|
| STBLpay | Provides the checkout page | The screen where the buyer approves the payment with a passkey |
| STBLpay | Provides the merchant console | Issuing API keys, configuring Webhooks, approving refunds |
| Buyer | Applies for JPYC issuance | On the JPYC EX screen, the buyer applies for JPYC issuance and pays in yen by bank transfer |

## Scope of this site

| Subject | How this site treats it |
|---|---|
| Payment API, statuses, Webhooks | Integration details covered in this guide |
| Refunds | Only through the merchant console, where the owner approves with a passkey. Merchant servers cannot call a refund API (none exists) |
| Sandbox | An environment for trying your integration ([Sandbox](/testing/sandbox)) |
| Multi-account management, WooCommerce plugin | Planned after the first release ([Roadmap](/support/roadmap)) |

Availability and known limitations are summarized in [Known limitations](/support/limitations).

## Environments and URLs {/* #environments-and-urls */}

Start development in the Sandbox. Once you register in the Sandbox merchant console, you can issue an API key and try things right away.

| Environment | Merchant console | API base URL |
|---|---|---|
| Sandbox (for development and testing; JPYC EX is a mock) | https://merchant.sandbox.stbl-pay.com/ ([register](https://merchant.sandbox.stbl-pay.com/register)) | `https://api.sandbox.stbl-pay.com` |
| Production | Announced here after launch | Announced here after launch |

Set up API keys, domains, and Webhooks separately for each environment, and manage each URL together with its key. For the checkout page, use the `checkoutUrl` in the creation response.

## Read these first

1. [Quick Start](/getting-started/quickstart): from registering in the Sandbox and issuing an API key to your first payment
2. [Payment flow](/getting-started/payment-flow), [Money flow](/getting-started/money-flow), [Client and server responsibilities](/getting-started/responsibilities)
3. [Completion check](/lifecycle/completion) and [Webhooks](/webhooks/events)

For refunds, see [Scope of refunds](/refunds/overview).
