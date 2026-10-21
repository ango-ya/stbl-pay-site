---
title: Idempotency and ordering
sidebar_label: Idempotency and ordering
sidebar_position: 4
---

# Idempotency and ordering

Idempotent means that repeating the same operation gives the same result as doing it once ([glossary](/reference/glossary)).

Retries do not change the event body or `id`. **Deduplicate by putting a UNIQUE constraint on the `id` of the signature-verified body.** The `Stbl-Pay-Event-Id` header is not covered by the signature, so do not use it as the idempotency key.

## Separate test notifications first

After signature verification, before saving to the inbox, check whether `test === true` on the value you get from running `JSON.parse` on the raw body. For a test notification, change no order and return only `2xx` ([Test notifications](/webhooks/events#test-notifications)).

## Separate receiving from processing

The receiving handler persists the verified event to the inbox, and then returns `2xx`. Record "saved" and "business processing completed" as separate states.

```sql
CREATE TABLE stbl_pay_inbox (
  event_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
```

If a retry arrives and an unprocessed event already exists, do not create a new row. Let the worker retry unprocessed rows. Ignore unknown types without changing any order.

## Transaction for business processing

Do the following in the same DB transaction.

1. Lock the event and the corresponding order, and check whether it has already been processed.
2. Verify that the payment ID, merchant, and amount match the order. Hold mismatches for investigation.
3. Update the order conditionally, and record the outbox for fulfillment and similar actions under a unique order key.
4. Record the processed time on the event.

Call external processing from a worker after the commit, and pass an idempotency key to external services too. Route status lookups and manual handling through the same order update path, so that you never ship goods twice, even when the event IDs differ.

## Ordering

Arrival order is not guaranteed, including retries. Do not overwrite an order based only on `created_at` ordering. Verify the terminal state of the payment against the order. If events are inconsistent, for example different terminal results arrive for the same payment, do not process them automatically. Route them to status lookup and investigation.

See also [completion criteria](/lifecycle/completion) and the [event list](/webhooks/events).
