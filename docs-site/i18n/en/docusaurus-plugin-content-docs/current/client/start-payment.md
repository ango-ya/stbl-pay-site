---
title: Start a payment
sidebar_label: Start a payment
sidebar_position: 2
---

# Start a payment

After your server saves the mapping between the payment ID and the order, navigate the whole page to the `checkoutUrl` received from the API. Do not build the URL yourself from the payment ID.

```js
async function startCheckout(orderId) {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  if (!response.ok) throw new Error('Could not start the payment');
  const { checkoutUrl } = await response.json();
  window.location.assign(checkoutUrl);
}
```

`/api/checkout` is an example of an endpoint the merchant provides. Apply your own session authentication and CSRF protection, and verify the order's owner and amount on the server.

Disable the button while the request is in flight. On the server too, use the same `orderId` when retrying the same order. Do not create a new order number just because of a communication failure.

Persist the order details before navigating, and specify the return destination as `returnUrl` when you create the payment. Do not mark an order as paid merely because the buyer navigated or returned.

Next, see [Showing the result](/client/handle-result).
