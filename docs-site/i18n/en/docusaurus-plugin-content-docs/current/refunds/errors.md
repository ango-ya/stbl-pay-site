---
title: When a refund is not possible
sidebar_label: When a refund is not possible
sidebar_position: 4
---

# When a refund is not possible

When you cannot start a refund, the Refund (返金) screen shows the reason.

| Message on screen | What to do |
|---|---|
| "Only completed payments can be refunded" (完了した決済だけ返金できます) | Try again after the payment becomes `settled` |
| "Cannot refund because the buyer's receiving address is unknown" (お客さまの受取先が分からないため返金できません) | Contact your operations person |
| "No amount is refundable now" (いま返金できる額がありません) | The amount is already refunded, or reserved by a refund pending approval. Or the balance of the receiving wallet is insufficient. Check the reason text shown with it on the screen, and the history |
| "A refund is possible after the operation in progress is confirmed" (進行中の操作の確認後に返金できます) | Another operation on the wallet is in progress. Recheck after the confirmation finishes |
| "There is an operation pending approval" (承認待ちの操作があります) | Cancel the pending approval, or recheck after a while |
| "Cannot refund because the receiving wallet has not been created yet" (受取ウォレットがまだ作成されていないため返金できません) | Recheck after the receiving wallet is created |
| "Cannot refund now because the status cannot be confirmed" (状況を確認できないため、今は返金できません) | Click Recheck (再確認) after a while |

The screen also shows the reason when a refund is rejected at the assembly or approval stage. When a wallet update is required, you can go to it from the screen with Go to update (アップデートへ). The same applies to rejections such as the refund amount exceeding the refundable amount, or the balance of the receiving wallet being insufficient. These are responses from the API that the merchant console uses, not an API that your server calls.

## When the result is unknown

If communication fails or you close the screen after approving a refund, the refund may still have been accepted. Do not assume it was not refunded and refund again. When you reopen the transaction details, the screen shows the refund in progress again from the server's records. While the status is Checking result (結果確認中), you cannot start a new refund.
