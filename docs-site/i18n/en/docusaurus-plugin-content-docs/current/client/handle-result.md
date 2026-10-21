---
title: Return and receiving the result
sidebar_label: Return and receiving the result
sidebar_position: 3
---

# Return and receiving the result

`returnUrl` is the URL the buyer returns to on your site. The query on the return URL, a status sent from the browser, and a successful page navigation are not evidence that the payment succeeded.

## Return page

Authorize access to the order with your own login, and show the order status held on your own server. If your order hasn't been updated by the time the buyer returns, check by performing a [status lookup](/server/retrieve-payment) from your server.

The return URL has the payment ID appended as the `stbl_pay_intent` query parameter (example: `?stbl_pay_intent=pi_xxx`). You can use it as a clue to which payment the buyer returned from, but the buyer can rewrite it. Verify that it matches the payment ID tied to your own order before you look it up.

| Category | Corresponding values | Example display |
|---|---|---|
| Succeeded | [`settled`](/reference/rest#status-values) | Your payment has been confirmed |
| In progress | [`created`, `signed`, `issue_pending`, `deposit_confirmed`, `deploying`, `executing`](/reference/rest#status-values) | We are checking your payment |
| Did not succeed | [`canceled`, `expired`, `failed`](/reference/rest#status-values) | Your payment was not completed |
| Needs attention | [`nonce_conflict`](/reference/rest#status-values) | Confirmation is needed. Please contact support |
| Cannot be looked up | Communication failure or timeout (not a payment status) | We cannot check right now. Please check your order history |

A failed lookup is not a failed payment. Prompting the buyer to pay again right away can lead to double charging.

For a payment that did not succeed, no JPYC was sent to the merchant. The JPYC the buyer prepared normally remains in the buyer's wallet. However, when a `failed` payment has `failedReason` of `deposit_recipient_mismatch`, the deposit destination did not match the buyer's wallet, so the JPYC does not necessarily remain in the buyer's wallet. In this case, direct the buyer to support. When you ask the buyer to pay again, **create the payment again with a new `orderId`.** If you create one with the same `orderId`, the finished payment is returned as is ([Idempotency](/server/create-payment#idempotency)).

## If the browser does not return

Deposit detection, balance checks, and transfer execution proceed independently of the browser. However, when a bank transfer is needed, the checkout page is required until the buyer goes from the checkout page to the JPYC EX procedure (until the status becomes `issue_pending`). If the buyer closes the tab before that, the payment does not progress unless the buyer returns and continues the procedure, and it becomes `expired` at the operation deadline. Signing alone also does not guarantee success. Get the result through Webhooks and periodic lookups of unfinalized orders.

Make the [decision to deliver goods](/lifecycle/completion) on the server.
