---
title: Preparing to integrate with your EC site
sidebar_label: Preparing to integrate with your EC site
sidebar_position: 1
---

# Preparing to integrate with your EC site

You implement two things: a request to your own server to create the payment, and navigation to the dedicated checkout page.

## What you need

- An endpoint that authenticates and authorizes your own orders and calculates the amount on the server
- Server-side processing that calls the [Create payment API](/server/create-payment)
- A purchase button that navigates to `checkoutUrl`
- A return page that shows the status of your own order

Do not pass the API key to the browser. Call the STBLpay API from your server.

Passkey authentication and signing are the responsibility of the dedicated checkout page, which runs on a different [origin](/reference/glossary) from your site. Do not embed the checkout screen in your page with an iframe, popup, or modal.

Next, see [Start a payment](/client/start-payment).
