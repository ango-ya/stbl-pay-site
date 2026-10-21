---
title: When a refund is not possible
sidebar_label: When a refund is not possible
sidebar_position: 4
---

# When a refund is not possible

When you cannot start a refund, the 「返金」 (Refund) screen shows the reason.

| Message on screen | What to do |
|---|---|
| 「完了した決済だけ返金できます」 (Only completed payments can be refunded) | Operate after the payment becomes `settled` |
| 「お客さまの受取先が分からないため返金できません」 (Cannot refund because the buyer's receiving address is unknown) | Contact your operations person |
| 「いま返金できる額がありません」 (No amount is refundable now) | The amount is already refunded or reserved by a refund pending approval. Or the balance of the receiving wallet is insufficient. Check the reason text shown together on the screen, and the history |
| 「進行中の操作の確認後に返金できます」 (A refund is possible after the operation in progress is confirmed) | Another operation on the wallet is in progress. Recheck after the confirmation finishes |
| 「承認待ちの操作があります」 (There is an operation pending approval) | Cancel the pending approval, or recheck after a while |
| 「受取ウォレットがまだ作成されていないため返金できません」 (Cannot refund because the receiving wallet has not been created yet) | Recheck after the receiving wallet is created |
| 「状況を確認できないため、今は返金できません」 (Cannot refund now because the status cannot be confirmed) | Press 「再確認」 (Recheck) after a while |

When a refund is rejected at the assembly or approval stage, the screen also shows the reason. When a wallet update is required, you can proceed from the screen with 「アップデートへ」 (Go to update). The same applies to rejections such as the refund amount exceeding the refundable amount, or the balance of the receiving wallet being insufficient. These are responses from the API that the merchant console uses, not something the merchant server calls.

## When the result is unknown

If communication fails or you close the screen after approving a refund, the refund may still have been accepted. Do not assume "it was not refunded" and refund again. When you reopen the transaction details, the refund in progress is shown again from the server's records. While the status is 「結果確認中」 (Checking result), you cannot start a new refund.
