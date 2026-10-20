---
title: トラブルシューティング
sidebar_label: トラブルシューティング
sidebar_position: 2
---

# トラブルシューティング

| 症状 | 確認すること |
|---|---|
| API キーを発行できない（409 `store/api_key_limit_reached`） | 有効なキーが 1 店舗 10 本に達している。使っていないキーを失効させる |
| 決済を作れない | 接続先、`x-stbl-api-key`（失効していないか）、文字列の `amountJpy`、エラーの `code` |
| 再試行しても同じ決済が返る | 同じ `orderId` の冪等動作。更新や新規決済にはならない |
| 決済作成が 409 `merchant/domain_required` になる | 加盟店コンソールでドメインを登録しているか（[ドメイン登録](/security/domain)） |
| 決済作成が 403 `merchant/suspended` になる | 加盟店が利用停止中。再開されるまで作成できない。API キーは失効していない |
| 同じ `orderId` で 409 `payment/order_terminated` になる | 停止で中止済みの決済。新しい `orderId` で作り直す（[利用停止](/lifecycle/edge-cases#加盟店の利用停止)） |
| 復帰先を拒否される | HTTPS、userinfo なし、登録 origin との一致 |
| 指定期限を拒否される | `merchantExpiresAt` が作成時点から3日以内になっていないか |
| 決済ページへ進めない | API の `checkoutUrl` をそのまま使用しているか |
| 状態を取得できない | 作成時の決済 ID・環境が一致するか。通信エラーを `failed` にしていないか |
| 金額が照会結果にない | 正常。注文データ・作成応答・検証済み Webhook を参照 |
| Webhook の署名が合わない | raw body、対象環境の鍵、時刻、複数 `v1` の保持 |
| Webhook が届かない | 受信先の設定、永続化エラー、応答、再送打ち切り。API で突合 |
| 同じ通知が繰り返し届く | 応答が成功しているか。ボディの `id` で冪等に処理しているか |
| `nonce_conflict` になった | 自動再請求・出荷を止め、決済 ID と時刻を添えて運用調査 |
| 返金を API から実行できない | 現在の返金は加盟店コンソールだけ。[返金の手順](/refunds/execute) |

## 問い合わせ先

導入時の STBLpay の担当者に問い合わせてください。問い合わせには、次を添えてください。

- 対象の環境（API の接続先 URL）とバージョン
- 発生時刻
- 決済 ID とイベント ID
- HTTP ステータスと `code`

API キー、Webhook 署名鍵、受取先ウォレットの秘密鍵やシードフレーズは添付しないでください。

関連する [異常系](/lifecycle/edge-cases)、[署名検証](/webhooks/signature)、[環境確認](/testing/sandbox)も参照してください。
