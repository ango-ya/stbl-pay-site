---
title: Webhook イベントリファレンス
sidebar_label: Webhook イベント
sidebar_position: 3
---

# Webhook イベントリファレンス

通常の REST API が camelCase なのに対し、**Webhook payload は snake_case** です。

## 共通形式

ボディは `id`（`evt_` で始まるイベント ID）、`type`、`created_at`（UTC の `Z` で終わる ISO 8601）、`data` を持ちます。`created_at` はイベント生成時刻で、署名ヘッダの送信時刻 `t` とは異なります。

| ヘッダ | 内容 |
|---|---|
| `Stbl-Pay-Signature` | `t=<Unix秒>,v1=<HMAC-SHA256のhex>`。鍵の移行期間は `v1` が複数 |
| `Stbl-Pay-Event-Id` | ボディの `id` の複製。再送でも不変 |

重複排除には **署名検証済みボディの `id`** を使います。ヘッダのイベント ID は署名対象外です。

## イベントと data

`payment.settled`、`payment.failed`、`payment.canceled`、`payment.expired` の4種類は、共通の `data` の形を使います。`payment.failed` でも金額などの共通フィールドは省略しません。

| フィールド | 参照・注意点 |
|---|---|
| `payment_intent_id` / `order_id` | 自社注文との対応。`payment_intent_id` は `pi_` で始まる ID。`order_id` は決済作成時に渡した `orderId` で、渡さなかったときは null |
| `status` | イベントに対応する終端状態 |
| `merchant_id` / `payout` | 加盟店（`m_` で始まる ID）と受取先（小文字の `0x` 付き 20 バイトのアドレス） |
| `amount_jpy` / `fee_jpy` / `net_received_jpy` | すべて円建ての文字列。数値型へ無造作に変換しない。イベントごとの値は[金額の扱い](#金額の扱い)を参照 |
| `tx_hash` / `settled_at` | null 許容。`tx_hash` は小文字の `0x` 付き 32 バイト、`settled_at` は UTC の `Z` で終わる ISO 8601。取消・失効では両方 null とし、キーは省略しない |
| `failed_reason` | null 許容の文字列。値は[分類コード](/reference/rest#failed_reason-の分類コード)の閉じた集合。受け手は未知の値を失敗のフォールバックに落とす。発行体の取引可否判断の理由は含まない |

## 金額の扱い

`amount_jpy` は注文の金額で、どのイベントでも注文額のままです。`fee_jpy` と `net_received_jpy` はイベントによって次のように変わります。

| イベント | `amount_jpy` | `fee_jpy` / `net_received_jpy` |
|---|---|---|
| `payment.settled` | 注文額 | チェーン上で実際に引かれた手数料と、加盟店の受取額（実額） |
| `payment.failed` / `payment.canceled` / `payment.expired` | 注文額 | どちらも `"0"` |

`payment.settled` の実額は決済の実行結果から取ります。実行結果の手数料を取れなかった回だけ、決済の作成時の見積りで代わりに計算した値が入ります。そのため、`payment.settled` の `fee_jpy` が作成応答の `feeJpy` と違うことがあります。入金の計上には `payment.settled` の `net_received_jpy` を使ってください。

失敗・取消・失効の通知は資金が動いていないため、`fee_jpy` と `net_received_jpy` は `"0"` です。`amount_jpy` が注文額のまま入っていても、加盟店への入金が成立したことを意味しません。入金計上は `payment.settled` またはサーバー間照会の `settled` を根拠にします。

## 配信と処理

受信成功は `2xx` です。[署名検証](/webhooks/signature)、[再送ポリシー](/webhooks/retry)、[冪等性](/webhooks/idempotency)を実装してください。未知の種別は安全に無視できるようにします。

`nonce_conflict` の通知はありません。確認は状態照会 API と運用調査で行います。

## テスト通知

加盟店コンソールから送るテスト通知だけは、`type` が `payment.settled` のまま、本文に `test: true` を持ちます。通常の通知に `test` というキーはありません。各フィールドの値は次のとおりです。

| フィールド | テスト通知の値 |
|---|---|
| `id` | `evt_test_` で始まる |
| `type` | `payment.settled` |
| `created_at` | 送信した日時 |
| `test` | `true` |
| `data.payment_intent_id` | `pi_test_` で始まる。実在する決済を指さない |
| `data.order_id` | `test_` で始まる。実在する注文を指さない |
| `data.status` | `settled` |
| `data.merchant_id` | 自社の加盟店 ID |
| `data.payout` | 登録している受取先のアドレス |
| `data.amount_jpy` / `data.net_received_jpy` | `"1000"` |
| `data.fee_jpy` | `"0"` |
| `data.settled_at` | 送信した日時 |
| `data.tx_hash` / `data.failed_reason` | `null` |

受信側での判定の手順は、[テスト通知の受信](/webhooks/events#テスト通知)を参照してください。
