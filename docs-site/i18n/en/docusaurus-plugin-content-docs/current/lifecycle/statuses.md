---
title: Status list
sidebar_label: Status list
sidebar_position: 1
---

# Status list

A payment has **11 statuses**. Whether a notification was delivered is not part of the status.

| Status | Category | Meaning |
|---|---|---|
| `created` | In progress | The payment intent has been created and is waiting for a signature |
| `signed` | In progress | The buyer's signature is done and the payment operation has been stored |
| `issue_pending` | In progress | The checkout page sent a notification that the reservation started. This does not mean the JPYC EX procedure is complete (the payment also reaches this status if the buyer quits midway) |
| `deposit_confirmed` | In progress | The deposit can no longer be reversed, or STBLpay confirmed that the balance is sufficient for a balance payment. Not yet executed |
| `deploying` | In progress | Creating the required wallets and confirming they exist. When ready, returns to `deposit_confirmed` |
| `executing` | In progress | STBLpay has started executing the payment and is confirming the result |
| `settled` | Terminal | The payment was executed successfully, and the transfer to the merchant and the fee distribution are complete |
| `canceled` | Terminal | The buyer canceled the payment on My Page (マイページ) |
| `expired` | Terminal | Ended because a deadline passed. Either the operation deadline passed without approval, the operation deadline passed after approval but before the buyer proceeded to the JPYC EX procedure, or the full payable amount was not available by the deposit deadline |
| `failed` | Terminal | The payment ended without succeeding. The reason is in `failedReason` ([classification codes](/reference/rest#failed-reason-codes)) |
| `nonce_conflict` | Terminal | The transfer result could not be determined and the confirmation limit was reached. It is unknown whether the transfer happened, or whether it succeeded or failed. This also applies when failures to read the number (nonce) continued up to the limit. Operational investigation is required ([details](/lifecycle/transitions#technical-details)) |

Terms such as "terminal", "succeed", and "payment intent" are in the [glossary](/reference/glossary).

The main reasons for `failed` are a destination mismatch, a definite failure before execution, an execution failure, reaching the retry limit, and merchant suspension. A payment whose execution deadline passes after the deposit or a sufficient balance was confirmed becomes `failed` (`userop_expired`), not `expired`.

Only `settled` means the payment succeeded. Do not provide goods based only on a signature, a deposit confirmation, or a completed submission.

## Terminal statuses

A payment that reaches a terminal status does not move to any other status. **A payment never goes from `canceled` back to `settled`.** Funds issued later remain in the buyer's wallet.

Distinguish this from the case where STBLpay cannot observe the cancellation of an external issuance reservation and the payment stays in `issue_pending`. See [Edge cases](/lifecycle/edge-cases) for details.

Do not use `nonce_conflict` to decide automatically whether a payment succeeded or failed. Follow up with a [status lookup](/server/retrieve-payment) and an investigation.

## Unknown values and lookup errors

A communication failure is not a payment status. If you receive an unknown value, do not provide goods or charge again. Treat the payment as under review and check with the [contact](/support/troubleshooting#contact).

Next, see [State transitions and deadlines](/lifecycle/transitions).
