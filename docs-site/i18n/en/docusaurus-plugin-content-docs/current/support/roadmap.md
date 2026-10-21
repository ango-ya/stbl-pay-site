---
title: Roadmap
sidebar_label: Roadmap
sidebar_position: 4
---

# Roadmap

These are features planned for after the 1st release. We will announce the timing and details on this page once they are decided.

## Multi-account management

This will let staff other than the owner use the merchant account.

- The owner issues an invitation URL and gives it to the staff member. The staff member registers a passkey on their own device and can use the account once the owner approves. Email addresses are not used.
- For each staff member, the owner chooses separately whether to allow refunds and withdrawals (redemption). The owner can also set the target stores and a per-refund limit.
- The owner can remove a staff member at any time. A removed staff member can no longer operate the account from that point.

Until then, the owner's passkey performs all merchant console operations.

## WooCommerce plugin

A plugin that adds STBLpay as a payment method to a WooCommerce store.

- The plugin creates the payment, sends the buyer to the checkout page, and finalizes the order when it receives the Webhook.

Until then, integrate through the API, as described in [Integrating with an existing e-commerce site](/client/integrate-existing-ec).
