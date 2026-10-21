---
title: Troubleshooting
sidebar_label: Troubleshooting
sidebar_position: 2
---

# Troubleshooting

| Symptom | What to check |
|---|---|
| Cannot issue an API key (409 `store/api_key_limit_reached`) | The store has reached 10 active keys. Revoke unused keys |
| Cannot create a payment | The endpoint, `x-stbl-api-key` (is it revoked?), `amountJpy` as a string, and the error `code` |
| The same payment is returned on retry | Idempotent behavior for the same `orderId`. It does not update the payment or create a new one |
| Payment creation returns 409 `merchant/domain_required` | Have you registered a domain in the merchant console? ([Domain registration](/security/domain)) |
| Payment creation returns 403 `merchant/suspended` | The merchant is suspended. You cannot create payments until it is resumed. API keys are not revoked |
| 409 `payment/order_terminated` for the same `orderId` | The payment was aborted by the suspension. Create it again with a new `orderId` ([Suspension](/lifecycle/edge-cases#merchant-suspension)) |
| The return destination is rejected | HTTPS, no userinfo, and a match with the registered origin |
| The specified deadline is rejected | Check that `merchantExpiresAt` is within 3 days of the creation time |
| Cannot proceed to the checkout page | Are you using the API's `checkoutUrl` as is? |
| Cannot retrieve the status | Do the payment ID and environment from creation match? Are you treating a communication error as `failed`? |
| The amount is missing from the lookup result | This is normal. Refer to the order data, the create response, and the verified Webhook |
| The Webhook signature does not match | The raw body, the secret for the target environment, the time, and keeping multiple `v1` values |
| The Webhook does not arrive | The endpoint setting, persistence errors, responses, and resend cutoff. Reconcile with the API |
| The same notification arrives repeatedly | Is your response a success? Are you processing idempotently by the body's `id`? |
| `nonce_conflict` occurred | Stop automatic re-billing and shipping, and have operations investigate with the payment ID and time |
| Cannot run a refund from the API | Refunds are currently only through the merchant console. See [Refund procedure](/refunds/execute) |

## Contact {/* #contact */}

Contact your STBLpay representative from onboarding. Include the following with your inquiry:

- The target environment (the API endpoint URL) and version
- The time it occurred
- The payment ID and event ID
- The HTTP status and `code`

Do not attach API keys, Webhook signing secrets, or the private key or seed phrase of the receiving wallet.

See also [Edge cases](/lifecycle/edge-cases), [Signature verification](/webhooks/signature), and [Checking the environment](/testing/sandbox).
