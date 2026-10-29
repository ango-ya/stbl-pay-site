---
title: Troubleshooting
sidebar_label: Troubleshooting
sidebar_position: 2
---

# Troubleshooting

| Symptom | What to check |
|---|---|
| Cannot issue an API key (409 `store/api_key_limit_reached`) | The store has reached 10 active keys. Revoke unused keys |
| Cannot create a payment | The endpoint, `x-stbl-api-key` (check that it is not revoked), `amountJpy` as a string, and the error `code` (see [Errors](/reference/rest#errors)). 409 `store/disabled` means the store is disabled. If 500 `common/internal` keeps occurring, check that you did not use an `orderId` already used at another store of the same merchant (retrying does not resolve it) |
| The same payment is returned on retry | This is idempotent behavior for the same `orderId`. It does not update the payment or create a new one. If the returned `status` is terminal, do not send the buyer to `checkoutUrl` ([Idempotency](/server/create-payment#idempotency)) |
| Payment creation returns 409 `merchant/domain_required` | Check that you registered a domain in the merchant console ([Domain registration](/security/domain)) |
| Payment creation returns 403 `merchant/suspended` | The merchant is suspended. You cannot create payments until it is resumed. API keys are not revoked |
| 409 `payment/order_terminated` for the same `orderId` | The suspension aborted this payment, or it was created before the suspension and has not been sent yet. Create it again with a new `orderId` ([Suspension](/lifecycle/edge-cases#merchant-suspension)) |
| The return destination is rejected | Check for HTTPS, no userinfo, and that the host name of `returnUrl` matches the registered domain |
| The specified deadline is rejected | Check that `merchantExpiresAt` is more than 3 days after the creation time. A value that expires within 3 days of creation is rejected with 400 `payment/expires_at_too_soon`. Also check that it ends in UTC `Z`. A value with an offset such as `+09:00` is rejected with 400 `common/invalid_request` |
| Cannot proceed to the checkout page | Check that you use the API's `checkoutUrl` as is |
| Cannot retrieve the status | Check that the payment ID and environment match those from creation, and that you do not treat a communication error as `failed` |
| The amount is missing from the lookup result | This is normal. Refer to the order data, the create response, and the verified Webhook |
| The Webhook signature does not match | Check the raw body, the secret for the target environment, the time, and that you keep multiple `v1` values |
| The Webhook does not arrive | Check the endpoint setting, persistence errors, your responses, and the resend cutoff. Reconcile with the API |
| The same notification arrives repeatedly | Check that your response is a success and that you process idempotently by the body's `id` |
| `nonce_conflict` occurred | Stop automatic re-billing and shipping, and ask the [contact](#contact) to investigate with the payment ID (and the `txHash` from the status lookup, if there is one). You can find the payment ID in `paymentIntentId` of the create or status lookup response, or under Payment ID (決済 ID) on the Transaction details (取引の詳細) screen of the merchant console |
| Cannot run a refund from the API | Refunds are currently available only in the merchant console. See [Refund procedure](/refunds/execute) |

## Contact {/* #contact */}

If a reseller supported your onboarding, contact the reseller. Otherwise, contact Ango-ya, the developer of STBLpay, through its inquiry form. Include the following with your inquiry:

- The target environment (the API endpoint URL) and version
- The time it occurred
- The payment ID and event ID
- The HTTP status and `code`

Do not attach API keys, Webhook signing secrets, or the private key or seed phrase of the receiving wallet.

See also [Edge cases](/lifecycle/edge-cases), [Signature verification](/webhooks/signature), and [Sandbox](/testing/sandbox).
