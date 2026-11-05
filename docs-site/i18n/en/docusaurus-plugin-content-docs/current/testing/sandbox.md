---
title: Sandbox
description: "Describes the Sandbox environment for testing your integration. It is separate from production, and the JPYC EX part is replaced with a mock."
sidebar_label: Sandbox
sidebar_position: 1
---

# Sandbox

An environment for trying out your integration. It is separate from production, and the JPYC EX part is replaced with a mock.

| Item | URL |
|---|---|
| API base URL | `https://api.sandbox.stbl-pay.com` |
| Merchant console | https://merchant.sandbox.stbl-pay.com/ |
| Checkout page | `https://app.sandbox.stbl-pay.com` (use the `checkoutUrl` in the creation response) |

## Getting started

1. Register as a merchant with a passkey on the merchant console's [registration page](https://merchant.sandbox.stbl-pay.com/register). The referral code (紹介コード) is optional.
2. As described in [Preparation](/getting-started/prerequisites#merchant-side-preparation), create an online shop, issue an API key, and register your domain.
3. Set `STBL_PAY_BACKEND` in the [Quick Start](/getting-started/quickstart) to `https://api.sandbox.stbl-pay.com`, and try everything from creating a payment to checking its status.

Manage values such as API keys separately for production and the sandbox (see [API keys](/security/api-keys)). The items to check are in [Test scenarios](/testing/scenarios).

## Multiple environments and local development {/* #multiple-environments */}

A merchant has one domain, one Webhook endpoint, and one signing key. If you connect several environments to the sandbox, such as development and staging, and want each to use its own domain and Webhook, we recommend registering a merchant for each environment. Alternatively, to use a single merchant, add an environment prefix to `orderId` (for example, `dev-` or `stg-`), receive Webhooks at a shared endpoint, verify the signature, and then route each one to its environment by the prefix.

The [requirements for `returnUrl`](/security/domain#returnurl-requirements) are the same in the sandbox: you cannot use `localhost`, `http://`, or a URL with a port other than 443. To test the return after payment from an environment running locally, register the hostname of a URL exposed through a tunnel or similar as your domain, or deploy to a public environment. If you omit `returnUrl`, you can still test everything from creating a payment to its success. To test your return handling, open your local return page directly with `?stbl_pay_intent=<paymentIntentId>` appended after the payment reaches a terminal state (this does not test the move from the checkout page itself).

You can test domain registration and payments even if your test environment is protected by Basic authentication or other access restrictions, because STBLpay does not access your site when you register a domain. Proof of domain ownership is optional and is not required for payments. If you do test it, use a DNS TXT record, which is not affected by your site's access restrictions (see [When verification fails](/security/domain#when-verification-fails)).
