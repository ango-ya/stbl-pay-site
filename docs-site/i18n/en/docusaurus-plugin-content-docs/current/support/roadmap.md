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

## Resetting a lost passkey

This will let you recreate the owner's passkey if it is lost.

- The owner registers approvers in advance. An approver can be another person, such as an assistant manager, or your own second device.
- If the passkey is lost, the passkey can be reset once any one of the registered approvers approves it.
- Approvers can only approve a reset. They cannot withdraw sales, issue refunds, or change settings.
- If a reset you do not recognize is requested, you can cancel it before it is approved.

Until then, if you lose the owner's passkey, you can no longer move the JPYC in the receiving wallet, and STBLpay cannot restore it either ([Money flow](/getting-started/money-flow)).

## WooCommerce plugin

A plugin that adds STBLpay as a payment method to a WooCommerce store.

- The plugin creates the payment, sends the buyer to the checkout page, and finalizes the order when it receives the Webhook.

Until then, integrate through the API, as described in [Integrating with an existing e-commerce site](/client/integrate-existing-ec).
