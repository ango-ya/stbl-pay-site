---
title: Refund procedure
sidebar_label: Refund procedure
sidebar_position: 2
---

# Refund procedure

Refunds are made in the merchant console. You need to be logged in to the merchant console, and you need the owner's passkey for approval.

## Procedure

1. In the merchant console, open the target store from the menu item 「お店と QR コード」 (Store & QR code), then open the 「この店舗の売上」 (This store's sales) tab.
2. Open 「詳細」 (Details) for the transaction to refund, and find 「返金」 (Refund) on the 「取引の詳細」 (Transaction details) screen.
3. Enter the amount in 「返金額（円）」 (Refund amount (JPY)). To refund the full amount, press 「全額」 (Full amount) (the amount refundable at that moment is filled in).
4. Press 「返金する」 (Refund). The server assembles the refund operation.
5. In the 「返金を承認しますか？」 (Approve this refund?) dialog, check the order number, payment ID, refund amount, and refund destination, then press 「パスキーで承認」 (Approve with passkey).
6. Check the result on the screen and in 「返金の履歴」 (Refund history).

The refund destination is fixed to the receiving address of the buyer for that payment. The destination in the dialog is for confirmation and cannot be changed. To cancel before approval, press 「やめる」 (Cancel). A refund that has been assembled but not approved can be canceled with 「承認待ちを取りやめる」 (Cancel pending approval) in 「返金の履歴」 (Refund history).

## Checking the result

A refund you approve first becomes "accepted". Acceptance is not completion. It becomes 「返金完了」 (Refund completed) only after the result is finalized on-chain.

| Status in history | Meaning |
|---|---|
| 「受付済み（送信待ち）」 (Accepted, waiting to be sent) | The approval was accepted. Not yet sent |
| 「処理中」 (Processing) | Sent, waiting for the result |
| 「返金完了」 (Refund completed) | Finalized. The refund amount counts toward the finalized refunded amount |
| 「失敗」 (Failed) | The refund was not made. A reason code may appear in the history (it may not) |
| 「結果確認中」 (Checking result) | The result cannot be determined yet |

A communication failure or closing the screen does not by itself mean the refund failed. While the status is 「結果確認中」 (Checking result), or while the result is unknown after approval, do not start a new refund. Check the result with 「再確認」 (Recheck). Even if you reopen the screen, the refund in progress is shown again from the server's records.

The history shows the acceptance time and the finalization time separately. The history remains after a full refund.
