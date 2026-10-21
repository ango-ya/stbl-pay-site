---
title: Create a payment
sidebar_label: Create a payment
sidebar_position: 2
---

# Create a payment

To "create a payment" is to register an amount and an order number with STBLpay and have it create a receipt for the payment (a [payment intent](/reference/glossary)).

Determine the amount and the order number on the merchant server. Do not use an amount received from the browser as is, and verify that the logged-in buyer can pay for that order.

## Creation flow

1. Save the order and assign an `orderId` that does not change across payment retries.
2. Call `POST /payment_intents` with the API key.
3. Persist the mapping between `paymentIntentId` and the order.
4. Pass the returned `checkoutUrl` to the browser.

```js
// order is the server-side order that has already gone through authorization and price calculation.
const response = await fetch(`${process.env.STBL_PAY_BACKEND}/payment_intents`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-stbl-api-key': process.env.STBL_PAY_API_KEY,
  },
  body: JSON.stringify({
    amountJpy: order.totalJpy, // decimal string
    orderId: order.id,
    returnUrl: `https://shop.example.com/orders/${encodeURIComponent(order.id)}/return`,
  }),
});
if (!response.ok) throw new Error(`Payment creation failed: HTTP ${response.status}`);
const payment = await response.json();
```

This is an example of the API call only. In your own endpoint, implement authentication, order ownership checks, and CSRF protection, and connect API errors to [handling by code](/reference/rest#errors).

## Idempotency {/* #idempotency */}

If you create again from the same store with the same `orderId`, the existing payment is returned instead of a new one. Use the same value for timeouts and double clicks, and do not generate a random value for each retry. If you create concurrently with the same `orderId`, there is no error, and both requests get the same payment with a 201.

The existing payment is returned as is even if it has reached a [terminal](/reference/glossary) status such as expired or settled. A payment in a terminal status cannot be paid, so check the `status` in the response before sending the buyer to `checkoutUrl`. If it is `settled`, the payment is already done. For any other terminal status, confirm how to handle the order, and then create again with a new `orderId`.

As an exception, creating again **after a merchant suspension is lifted** may not return the existing payment. Note that while the merchant is suspended, creating a payment itself is rejected with 403 `merchant/suspended`. If the existing payment was aborted by the suspension, or was created before the suspension and had not yet started sending, 409 `payment/order_terminated` is returned (`details` is `{ paymentIntentId, status, failedReason }`). In this case, no `checkoutUrl` is returned. **Create again with a new `orderId`.** For any other existing payment (settled, expired, canceled, already started sending, and so on), the existing payment is returned as before. For how suspension is handled, see [Merchant suspension](/lifecycle/edge-cases#merchant-suspension).

Sending a different amount or deadline with the same `orderId` does not update the existing payment. Manage a change to the order terms, or a new payment after a terminal status, as a separate payment attempt, after checking its mapping to the existing payment and preventing double charging.

If you have multiple stores, assign order numbers that are unique within the merchant. In the current specification, the uniqueness constraint is per merchant, while retrieving an existing payment is per store. If you use the same number in another store, that store cannot retrieve the existing payment, and the result is 500 `common/internal`. Retrying does not resolve it.

## Domain registration

To create an EC payment, you must have registered a domain in the merchant console. If it is not registered, 409 `merchant/domain_required` is returned. For the procedure, see [Domain registration](/security/domain).

## Deadlines and return destination

Check the operation expiry in `checkoutExpiresAt` in the response. The optional `merchantExpiresAt` acts as an upper limit on the **deposit deadline**, and the operation expiry does not become shorter (you can only specify a time more than 3 days after creation, and the operation expiry is shorter than that). It also does not extend the deadline of an existing payment. For details, see [State transitions and deadlines](/lifecycle/transitions).

Make `returnUrl` an HTTPS URL on a registered domain, and do not include secret information (for requirements and examples, see [Domain registration](/security/domain#returnurl-requirements)). A return is not proof that the payment succeeded.

For the complete field definitions, see the primary source in the [REST reference](/reference/rest).
