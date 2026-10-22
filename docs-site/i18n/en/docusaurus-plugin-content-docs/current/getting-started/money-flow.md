---
title: Money flow
sidebar_label: Money flow
sidebar_position: 2
---

# Money flow

The buyer pays in JPYC, and the merchant receives JPYC. A buyer without enough JPYC approves the payment, then applies for issuance at JPYC EX and pays in Japanese yen to obtain JPYC. This page explains the path JPYC takes from the buyer to the merchant, and then back to yen. Term definitions are in the [Glossary](/reference/glossary).

## What's involved

- **JPYC**: A yen-denominated stablecoin: 1 JPYC = 1 yen. STBLpay payments are made in JPYC.
- **JPYC EX**: The issuer's platform for issuing and redeeming JPYC (converting it back to yen). Buyers and merchants deal with JPYC EX directly; STBLpay does not sit in between.
- **Polygon**: The blockchain JPYC runs on. Both the buyer's wallet and the merchant's receiving wallet are on Polygon.

## Flow

1. **The buyer approves the payment.** On the checkout page, the buyer approves the payment details with a passkey. No JPYC moves at this point.
2. **Once the JPYC is available, STBLpay sends the transfer.** If the JPYC in the buyer's wallet covers the payment amount, STBLpay confirms this and executes the transfer. A buyer without enough JPYC goes from the checkout page to the JPYC EX procedure after approving, applies for JPYC issuance, and pays in yen by bank transfer. When the bank transfer is confirmed, JPYC EX issues JPYC to the buyer's wallet. Once the issued amount plus the current balance is enough, STBLpay executes the transfer. The transfer sends JPYC from the buyer's wallet to the merchant's receiving wallet, and the STBLpay fee is deducted in the same transaction.
3. **JPYC arrives in the merchant's receiving wallet.** Check the amount received (after the fee) in `net_received_jpy` of the `payment.settled` Webhook. In failure, cancellation, and expiry notifications it is `"0"`, so don't use it to record deposits. The JPYC stays in the receiving wallet and is also the source of funds for [refunds](/refunds/overview).
4. **The merchant converts the JPYC back to yen.** Redeem the JPYC in the receiving wallet at JPYC EX to get yen. The plan is to let you start the JPYC EX procedure from "Withdrawal" (引き出し) in the merchant console. **This is currently in preparation.**

Example: a buyer with a JPYC balance of 0 pays for a 4,980 yen order

1. The buyer approves with a passkey on the checkout page.
2. The buyer proceeds from the checkout page to the JPYC EX procedure, applies for 4,980 yen worth of issuance, and pays 4,980 yen by bank transfer.
3. 4,980 JPYC is issued to the buyer's wallet.
4. STBLpay confirms the deposit and executes the transfer, and 4,980 JPYC minus the fee arrives in the merchant's receiving wallet.

## Receiving wallet

- Each merchant has one wallet on Polygon, tied to the passkey of the merchant's owner.
- The address is in `payout` in the Webhook.
- The wallet is created at the first payment (the status passes through `deploying`).
- Moving JPYC out of the receiving wallet requires approval with the owner's passkey. STBLpay cannot move it on its own.

## Related

- [Payment flow](/getting-started/payment-flow): the flow of screens and APIs
- [Completion check](/lifecycle/completion): checking the amount received and the fee
- [Scope of refunds](/refunds/overview): refunds from the receiving wallet
