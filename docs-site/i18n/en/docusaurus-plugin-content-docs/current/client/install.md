---
title: Preparing to integrate with your EC site
sidebar_label: Preparing to integrate with your EC site
sidebar_position: 1
---

# Preparing to integrate with your EC site

The merchant implements a creation request to its own server and navigation to the dedicated checkout page.

## What you need

- An endpoint that authenticates and authorizes your own orders and calculates the amount on the server
- Server-side processing that calls the [Create payment API](/server/create-payment)
- A purchase button that navigates to `checkoutUrl`
- A return page that shows the status of your own order

Do not pass the API key to the browser; call the STBLpay API from the merchant server.

Passkey authentication and signing are the responsibility of the dedicated checkout page (a different [origin](/reference/glossary) from the merchant site). Do not embed the checkout screen in a merchant page with an iframe, popup, or modal.

Next, see [Start a payment](/client/start-payment).
