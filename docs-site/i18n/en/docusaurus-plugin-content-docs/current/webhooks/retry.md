---
title: Retry policy
sidebar_label: Retry policy
sidebar_position: 3
---

# Retry policy

The same notification may arrive two or more times ([at-least-once](/reference/glossary)). For example, your server finished processing, but the `2xx` response did not reach STBLpay because of a timeout or a dropped connection. STBLpay cannot tell whether the notification was not delivered or only the response was lost, so it sends the notification again. If it did not resend, notifications could be lost instead. [Remove duplicate notifications by event `id`](/webhooks/idempotency).

Retries have a maximum count, so eventual delivery is not guaranteed. To prepare for notifications that never arrive, check unconfirmed orders with the [status lookup](/reference/rest#retrieve-payment).

## Endpoint URL requirements {/* #endpoint-url-requirements */}

Register the final URL that can receive a `POST` directly.

- HTTPS only. You cannot set a URL that includes a username or password (userinfo).
- Use a valid certificate issued by a publicly trusted certificate authority. It must not be expired, its hostname must match the URL, and your server must send the intermediate certificates too. STBLpay cannot connect to an endpoint that uses a self-signed certificate or a certificate issued by an internal certificate authority. In that case, STBLpay treats the delivery as a failure, retries it, and abandons it when the retry limit is reached. Delivery history (配信履歴) shows TLS verification failed (TLS の確認の失敗).
- You cannot set a URL that resolves to an internal or reserved address, or a URL whose hostname cannot be resolved. STBLpay performs the same validation on every delivery.
- **Redirects are not followed.** STBLpay treats a `3xx` response as a failure and retries. Register the destination URL.
- `2xx` is treated as success. How long STBLpay waits for the response (the timeout) and which responses count as failures (`3xx`, `4xx`, `5xx`, timeouts, and connection or TLS failures) are in `webhooks.paymentEvent` in the [OpenAPI specification](pathname:///openapi.yaml).

## Retry intervals

After a failure, STBLpay retries at 5 intervals: 3 seconds, 10 seconds, 30 seconds, 120 seconds, and 600 seconds. Together with the first attempt, that is 6 attempts in total, and then delivery is abandoned. On retries, the body and event ID stay the same, and the send time and signature are updated for each attempt.

## Response order

Verify the signature and input, store the event in a durable DB or queue, and then return `2xx`. If you respond first and then lose the notification because of a stop right after, STBLpay does not resend it.

```text
Receive → verify signature and input → persist while deduplicating by event.id → 2xx
                                                  ↓
                                        Worker updates the order
```

If persisting fails, do not return success. Run slow work, such as fulfilling goods or sending email, in a separate worker based on the persisted event.

## Abandonment and recovery from outages

STBLpay abandons notifications in these cases: when the retry limit (6 attempts including the first) is reached, and when you click Remove webhook (webhook を解除). Notifications abandoned by removal do not resume even if you set up again. When you change the endpoint URL, STBLpay also sends undelivered and pending-retry notifications to the new URL. STBLpay does not send notifications later for payments that occurred while no Webhook was configured. In the merchant console, Delivery history (配信履歴) under Payment completion notification endpoint (お支払い完了のお知らせ先) in the Integration setup (組み込みの準備) tab shows the status of each notification.

The delivery status of a notification is separate from the payment status. Even if a notification does not arrive, `settled` is still settled. Reconcile unconfirmed orders regularly with the [status lookup](/server/retrieve-payment), and check again after you recover from a long outage.

Do not depend on notification order, and make your [order updates idempotent](/webhooks/idempotency) as well.
