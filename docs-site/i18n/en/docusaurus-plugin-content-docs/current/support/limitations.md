---
title: Known limitations
sidebar_label: Known limitations
sidebar_position: 3
---

# Known limitations

This site describes the specification. It does not treat the specification, the implementation, and production availability as the same thing.

- **Refunds**: available only through the route where the owner approves with a passkey in the merchant console. We do not provide a refund API that you can call from the merchant server, or machine refunds executed with a merchant server key
- **Sandbox**: the environment for merchants to test in is in preparation ([Sandbox](/testing/sandbox))
- **Payment completion**: determined separately from whether Webhook delivery succeeds or the browser returns
- **`nonce_conflict`**: a terminal state whose outcome cannot be determined. There is no notification, and you need to run a status lookup and investigate
- **Multi-account management and the WooCommerce plugin**: not provided in the 1st release ([Roadmap](/support/roadmap))
- **Public URLs and distributables**: we do not present as defaults any URL whose existence or availability has not been confirmed

If the behavior of the provided environment differs from this site, check with the [contact](/support/troubleshooting#contact) before testing.
