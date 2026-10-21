---
title: Roadmap
sidebar_label: Roadmap
sidebar_position: 4
---

# Roadmap

These are features planned for after the 1st release. We will announce the timing and details on this page once they are decided.

## Multi-account management

This will let staff other than the owner use the merchant account.

- The owner issues an invitation URL and gives it to the staff member. The staff member registers a passkey on their own device, and can use the account once the owner approves. Email addresses are not used.
- For each staff member, the owner can choose whether to allow "refunds" and "withdrawals (redemption)" separately. The owner can also set the target stores and a per-refund limit.
- The owner can remove a staff member at any time. A removed staff member can no longer operate from that point.

Until then, all merchant console operations are done with the owner's passkey.

## WooCommerce plugin

A plugin that adds STBLpay as a payment method to a WooCommerce store.

- The plugin handles creating the payment, moving to the checkout page, and finalizing the order on receiving the Webhook.

Until then, integrate through the API, as described in [Integrating with an existing e-commerce site](/client/integrate-existing-ec).
