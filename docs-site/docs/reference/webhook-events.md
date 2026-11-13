---
title: Webhook イベントリファレンス
description: "Webhook イベントの項目と使い方の注意をまとめたリファレンスです。payload が snake_case である点など、決済通知を受ける際の要点が分かります。"
sidebar_label: Webhook イベント
sidebar_position: 3
---

# Webhook イベントリファレンス

通常の REST API が camelCase なのに対し、**Webhook payload は snake_case** です。

Webhook の本文とヘッダーの項目ごとの定義は、OpenAPI 3.1 の仕様書の `webhooks` にあります（[ブラウザーで見る](pathname:///openapi/#operation/receivePaymentEvent)・[openapi.yaml](pathname:///openapi.yaml)）。このページは、その概要と使い方の注意です。

## 共通形式

本文は `id`（イベント ID）・`type`・`created_at`・`data` を持ちます。署名は `Stbl-Pay-Signature` ヘッダーに入ります。ヘッダーと本文の項目は、[OpenAPI 仕様書の「決済の結果を受け取る」](pathname:///openapi/#operation/receivePaymentEvent)にあります。

- 重複排除には **署名検証済みの本文の `id`** を使います。`Stbl-Pay-Event-Id` ヘッダーは署名の対象外です。
- `created_at` はイベントを作った時刻で、署名ヘッダーの送信時刻 `t` とは別です。

## イベントと data

`payment.settled`、`payment.failed`、`payment.canceled`、`payment.expired` の4種類は、共通の `data` の形を使います。`payment.failed` でも金額などの共通フィールドは省略しません。取消・失効では `tx_hash` と `settled_at` が null になり、キーは省略しません。

- `order_id` は決済作成時に渡した `orderId` です。渡さなかったときは null です。
- 金額は円建ての文字列です。数値型へ無造作に変換しないでください。イベントごとの値は[金額の扱い](#金額の扱い)にあります。
- `failed_reason` は、`payment.failed` では[分類コード](/reference/rest#failed_reason-の分類コード)のどれかで、それ以外のイベントでは null です。未知の値でも Webhook を拒否せず、失敗のフォールバックに落とします。

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

加盟店コンソールから送るテスト通知だけは、`type` が `payment.settled` のまま、本文に `test: true` を持ちます。通常の通知に `test` というキーはありません。ID は `evt_test_`・`pi_test_` で始まり、実在する決済や注文を指しません。各フィールドの値は、[OpenAPI 仕様書](pathname:///openapi/#operation/receivePaymentEvent)の本文の `TestWebhookEvent` にあります。

受信側での判定の手順は、[テスト通知の受信](/webhooks/events#テスト通知)を参照してください。


## 返金イベント（公開準備中）

`refund.confirmed` と `refund.failed` のdataは `refund_id`、`payment_intent_id`、`order_id`（nullable）、`amount_jpy`、`status`、`tx_hash`（nullable）、`failed_reason`（nullable）、`settled_at`（nullable）です。typeとstatusはそれぞれconfirmed/failedに対応します。tx hashを確証を持って取得できなければnullです。支払人アドレスは含みません。paymentイベントのdataとして検証しないでください。配信先・HMAC・再送方式は共通です。
