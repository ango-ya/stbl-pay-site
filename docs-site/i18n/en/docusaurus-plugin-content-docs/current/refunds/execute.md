---
title: Refund procedure
sidebar_label: Refund procedure
sidebar_position: 2
---

# Refund procedure

You make refunds in the merchant console. You need to be logged in to the merchant console, and you need the owner's passkey for approval.

## Procedure

1. In the merchant console, open Store & QR code (お店と QR コード) from the menu, select the target store, and open the This store's sales (この店舗の売上) tab.
2. Open Details (詳細) for the transaction to refund, and find Refund (返金) on the Transaction details (取引の詳細) screen.
3. Enter the amount in Refund amount (JPY) (返金額（円）). To refund the full amount, click Full amount (全額). This fills in the amount that is refundable at that moment.
4. Click Refund (返金する). The server assembles the refund operation.
5. In the "Approve this refund?" (返金を承認しますか？) dialog, check the order number, payment ID, refund amount, and refund destination, then click Approve with passkey (パスキーで承認).
6. Check the result on the screen and in Refund history (返金の履歴).

The refund destination is fixed to the receiving address of the buyer for that payment. The destination in the dialog is for confirmation and cannot be changed. To cancel before approval, click Cancel (やめる). You can cancel a refund that has been assembled but not approved with Cancel pending approval (承認待ちを取りやめる) in Refund history (返金の履歴).

## Checking the result

When you approve a refund, it first becomes "accepted". Acceptance is not completion. The refund becomes Refund completed (返金完了) only after the result is finalized on-chain.

| Status in history | Meaning |
|---|---|
| Accepted, waiting to be sent (受付済み（送信待ち）) | The approval was accepted. Not sent yet |
| Processing (処理中) | Sent, waiting for the result |
| Refund completed (返金完了) | Finalized. The refund amount counts toward the finalized refunded amount |
| Failed (失敗) | The refund was not made. A reason code may appear in the history, but not always |
| Checking result (結果確認中) | The result cannot be determined yet |

A communication failure or closing the screen does not by itself mean the refund failed. While the status is Checking result (結果確認中), or while the result is unknown after approval, do not start a new refund. Check the result with Recheck (再確認). If you reopen the screen, it shows the refund in progress again from the server's records.

The history shows the acceptance time and the finalization time separately. The history remains after a full refund.
