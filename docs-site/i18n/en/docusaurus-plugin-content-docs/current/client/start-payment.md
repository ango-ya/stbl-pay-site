---
title: Start a payment
sidebar_label: Start a payment
sidebar_position: 2
---

# Start a payment

After your server saves the mapping between the payment ID and the order, navigate the whole page to the `checkoutUrl` you received from the API. Do not build the URL yourself from the payment ID.

```js
async function startCheckout(orderId) {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  if (!response.ok) throw new Error('Could not start the payment');
  const { checkoutUrl } = await response.json();
  // When a retry returns a terminal payment, the server does not return checkoutUrl. Go to your own order page (the URL is an example).
  if (!checkoutUrl) return window.location.assign(`/orders/${encodeURIComponent(orderId)}`);
  window.location.assign(checkoutUrl);
}
```

`/api/checkout` is an example of an endpoint you provide. Apply your own session authentication and CSRF protection, and verify the order's owner and amount on the server. If a retry for the same order returns an existing payment that is already terminal, the server does not return `checkoutUrl` to the browser (see [Idempotency](/server/create-payment#idempotency)).

Disable the button while the request is in flight. On the server, use the same `orderId` when retrying the same order. Do not create a new order number just because of a communication failure.

Persist the order details before navigating, and specify the return destination as `returnUrl` when you create the payment. Do not mark an order as paid merely because the buyer navigated or returned.

Next, see [Return and receiving the result](/client/handle-result).
