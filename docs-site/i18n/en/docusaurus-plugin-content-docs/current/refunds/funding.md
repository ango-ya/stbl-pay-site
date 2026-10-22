---
title: Refundable amount and funding source
sidebar_label: Refundable amount and funding source
sidebar_position: 3
---

# Refundable amount and funding source

The Refund (返金) screen shows the following amounts separately.

- **Payment amount**: The original payment amount (before fees)
- **Refunded (finalized)**: The total of refunds whose results are finalized. Only this amount counts as "refunded"
- **Reserved (accepted / pending approval)**: The total of accepted refunds whose results are not finalized, plus refunds pending approval
- **Refundable amount**: The payment amount minus the finalized and reserved amounts
- **Refundable now**: The refundable amount, narrowed further by the on-chain limit and the balance of the receiving wallet. Full amount (全額) fills in this amount

The funding source for a refund is the balance of the receiving wallet. The payment amount is before fees, but the amount the merchant receives is after fees. **To refund the full amount, the receiving wallet needs a balance for the full amount.** If the balance is insufficient, "Refundable now" decreases and the screen shows the reason. Prepare the funds, then click Recheck (再確認).

## Reasons the amount decreases

When "Refundable now" is smaller than "Refundable amount", the screen shows the reason.

- **The balance of the receiving wallet is insufficient.** Prepare the funds, then recheck.
- **The on-chain backing for the refund is insufficient.** This happens when the wallet received the payment before a wallet update, or when a refund to the same buyer was made earlier. The refundable amount is limited to the cumulative amount the buyer paid to that wallet.

When the screen cannot read on-chain values, it shows "cannot be confirmed" instead of guessing an amount. An amount that is shown is a value the server has confirmed. Do not cache it on your side and issue refunds based only on that.
