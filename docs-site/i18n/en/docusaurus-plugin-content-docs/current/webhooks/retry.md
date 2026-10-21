---
title: Retry policy
sidebar_label: Retry policy
sidebar_position: 3
---

# Retry policy

The same notification may arrive two or more times ([at-least-once](/reference/glossary)). For example, the merchant server finished processing, but the `2xx` response did not reach STBLpay because of a timeout or a dropped connection. STBLpay cannot tell whether the notification was not delivered or only the response was lost, so it sends again. If it did not resend, notifications could be lost instead. [Remove duplicate notifications by event `id`](/webhooks/idempotency).

On the other hand, retries have a maximum count, so eventual delivery is not guaranteed. To prepare for notifications that never arrive, check unconfirmed orders with the [status lookup](/reference/rest#retrieve-payment).

## Endpoint URL requirements {/* #endpoint-url-requirements */}

Register the final URL that can receive a `POST` directly.

- HTTPS only. URLs that include a username or password (userinfo) cannot be set.
- URLs that resolve to internal or reserved addresses, and URLs whose hostname cannot be resolved, cannot be set. The same validation is performed on every delivery.
- **Redirects are not followed.** A `3xx` response is treated as a failure and retried. Register the destination URL.
- `2xx` is treated as success.

## Retry intervals

The intervals after a failure are 5 steps: 3 seconds, 10 seconds, 30 seconds, 120 seconds, 600 seconds. Together with the first attempt, there are 6 attempts in total, and delivery is then abandoned. On retries, the body and event ID are kept, and the send time and signature are updated for each attempt.

## Response order

Verify the signature and input, store the event in a durable DB or queue, and then return `2xx`. If you respond first and lose the notification due to a stop right after, STBLpay will not resend.

```text
Receive → verify signature and input → persist while deduplicating by event.id → 2xx
                                                  ↓
                                        Worker updates the order
```

If persisting fails, do not return success. Run slow work such as fulfilling goods or sending email in a separate worker based on the persisted event.

## Abandonment and recovery from outages

Notifications are abandoned in these cases: when the retry limit (6 attempts including the first) is reached, and when you use "webhook を解除" (Remove webhook). Notifications abandoned by removal do not resume even if you set up again. When you change the endpoint URL, undelivered and pending-retry notifications are also sent to the new URL. Notifications for payments that occurred while no Webhook was configured are not sent later. In the merchant console, the 「配信履歴」 (Delivery history) under 「お支払い完了のお知らせ先」 (Payment completion notification endpoint) in the 「組み込みの準備」 (Integration setup) tab shows the status of each notification.

The delivery status of a notification is separate from the payment status. Even if a notification does not arrive, `settled` is still settled. Reconcile unconfirmed orders regularly with the [status lookup](/server/retrieve-payment), and check again after recovering from a long outage.

Do not depend on notification order, and make [order updates idempotent](/webhooks/idempotency) as well.
