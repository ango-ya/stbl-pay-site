---
title: Troubleshooting
sidebar_label: Troubleshooting
sidebar_position: 2
---

# Troubleshooting

| Symptom | What to check |
|---|---|
| Cannot issue an API key (409 `store/api_key_limit_reached`) | The store has reached 10 active keys. Revoke unused keys |
| Cannot create a payment | The endpoint, `x-stbl-api-key` (check that it is not revoked), `amountJpy` as a string, and the error `code` |
| The same payment is returned on retry | This is idempotent behavior for the same `orderId`. It does not update the payment or create a new one |
| Payment creation returns 409 `merchant/domain_required` | Check that you registered a domain in the merchant console ([Domain registration](/security/domain)) |
| Payment creation returns 403 `merchant/suspended` | The merchant is suspended. You cannot create payments until it is resumed. API keys are not revoked |
| 409 `payment/order_terminated` for the same `orderId` | The suspension aborted this payment. Create it again with a new `orderId` ([Suspension](/lifecycle/edge-cases#merchant-suspension)) |
| The return destination is rejected | Check for HTTPS, no userinfo, and a match with the registered origin |
| The specified deadline is rejected | Check that `merchantExpiresAt` is within 3 days of the creation time |
| Cannot proceed to the checkout page | Check that you use the API's `checkoutUrl` as is |
| Cannot retrieve the status | Check that the payment ID and environment match those from creation, and that you do not treat a communication error as `failed` |
| The amount is missing from the lookup result | This is normal. Refer to the order data, the create response, and the verified Webhook |
| The Webhook signature does not match | Check the raw body, the secret for the target environment, the time, and that you keep multiple `v1` values |
| The Webhook does not arrive | Check the endpoint setting, persistence errors, your responses, and the resend cutoff. Reconcile with the API |
| The same notification arrives repeatedly | Check that your response is a success and that you process idempotently by the body's `id` |
| `nonce_conflict` occurred | Stop automatic re-billing and shipping, and ask operations to investigate with the payment ID and time |
| Cannot run a refund from the API | Refunds are currently available only in the merchant console. See [Refund procedure](/refunds/execute) |

## Contact {/* #contact */}

Contact your STBLpay representative from onboarding. Include the following with your inquiry:

- The target environment (the API endpoint URL) and version
- The time it occurred
- The payment ID and event ID
- The HTTP status and `code`

Do not attach API keys, Webhook signing secrets, or the private key or seed phrase of the receiving wallet.

See also [Edge cases](/lifecycle/edge-cases), [Signature verification](/webhooks/signature), and [Checking the environment](/testing/sandbox).
