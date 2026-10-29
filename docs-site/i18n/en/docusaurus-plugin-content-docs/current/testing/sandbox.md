---
title: Sandbox
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
