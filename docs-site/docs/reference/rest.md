---
title: REST API リファレンス
description: "加盟店サーバーが呼ぶ REST API の概要と注意点です。項目ごとの型やエラー、リクエスト例は OpenAPI の仕様書にあり、そちらへの案内も載せています。"
sidebar_label: REST API
sidebar_position: 2
---

# REST API リファレンス

加盟店サーバーが呼ぶ API の概要と、使うときの注意です。接続先 URL は導入時に STBLpay の担当者へ問い合わせて受け取り（[問い合わせ先](/support/troubleshooting#問い合わせ先)）、公開 URL や localhost の既定値を仮定しないでください。

項目ごとの型・形式・制約、エラーの一覧、リクエストと応答の例は、OpenAPI 3.1 の仕様書にあります（[ブラウザーで見る](pathname:///openapi/)・[openapi.yaml](pathname:///openapi.yaml)）。コードの生成や、AI コーディングエージェントに読ませるときは、openapi.yaml を使ってください。

## エンドポイント一覧

| メソッド | パス | 認証 | 用途 |
|---|---|---|---|
| `POST` | `/payment_intents` | API キー（`x-stbl-api-key`） | [決済を作成する](#決済作成) |
| `GET` | `/payments/:paymentIntentId` | API キー（`x-stbl-api-key`） | [決済を照会する](pathname:///openapi/#operation/getPayment)（公開準備中。配備までは[状態確認](/server/retrieve-payment)を使う） |
| `GET` | `/payment_status/:paymentIntentId` | なし | 決済ページの状態確認 |
| `GET` | `/payment_intents/:paymentIntentId` | なし | 決済ページの表示情報 |
| `GET` | `/payment_intents/{paymentIntentId}/refundable` | 返金 API キー＋HTTP 署名 | [返金できる額を確かめる](pathname:///openapi/#operation/getMachineRefundable)（公開準備中） |
| `POST` | `/payment_intents/{paymentIntentId}/refunds/prepare` | 返金 API キー＋HTTP 署名 | [返金を準備する](pathname:///openapi/#operation/prepareMachineRefund)（公開準備中） |
| `POST` | `/payment_intents/{paymentIntentId}/refunds/submit` | 返金 API キー＋HTTP 署名 | [返金に署名して送る](pathname:///openapi/#operation/submitMachineRefund)（公開準備中） |
| `GET` | `/refunds/{refundId}` | 返金 API キー＋HTTP 署名 | [返金を照会する](pathname:///openapi/#operation/getMachineRefund)（公開準備中） |
| `GET` | `/payment_intents/{paymentIntentId}/refunds` | 返金 API キー＋HTTP 署名 | [決済ごとの返金を一覧する](pathname:///openapi/#operation/listMachinePaymentRefunds)（公開準備中） |
| `DELETE` | `/staged_operations/{stagedOpId}` | 返金 API キー＋HTTP 署名 | [準備を破棄する](pathname:///openapi/#operation/discardMachineStagedOperation)（公開準備中） |

リクエストとレスポンスの本文は JSON で、フィールドは camelCase です。

## 決済作成

`POST /payment_intents` で決済を作成し、利用者を遷移させる `checkoutUrl` を受け取ります。項目・エラー・例は [OpenAPI 仕様書の「決済を作成する」](pathname:///openapi/#operation/createPaymentIntent)にあります。

- 金額（`amountJpy` など）は、JSON number ではなく 10 進の文字列です（例：`"4980"`）。手数料などの端数も、浮動小数点数へ変換せずに扱ってください。`amountJpy` は 0 を超える値だけを受け付けます（`"0"` や負の値は 400 `common/invalid_request`）。それ以外に、API は金額の上限・下限をかけていません。運用上の取り決めは[問い合わせ先](/support/troubleshooting#問い合わせ先)に確認してください。
- `orderId` は決済を試すたびの ID で、冪等性のキーです。同じ店舗から同じ値で呼ぶと、既存の決済を返します。通信の再送では同じ値を、`failed`・`expired`・`canceled` のあとの払い直しでは新しい値を指定してください。複数店舗では加盟店全体で一意に採番してください（[店舗をまたぐ制約](/server/create-payment#冪等性)）。
- `returnUrl` は `https://` の URL を指定します。ホスト名は、加盟店コンソールで登録したドメインと一致していなくてもかまいません（[条件](/security/domain#returnurl-の条件)）。決済が終端に着くと、決済ページに戻るリンク（成立したときは「ショップに戻る」、それ以外の終端では「お支払い先に戻る」）が出ます。利用者が押すと、`returnUrl` に `stbl_pay_intent` クエリ（値は決済 ID）が付いて開きます。`returnUrl` に同じ名前のクエリがあると上書きされます。
- `merchantExpiresAt` は着金期限の上限です（[期限の扱い](/lifecycle/transitions)）。
- 応答の `status` が `created` でも、決済は成立していません。成立は Webhook か状態照会で確かめます。
- 応答の `feeJpy` と `netAmountJpy` は見積りです。入金の計上には `payment.settled` の `net_received_jpy` を使います（[金額の扱い](/reference/webhook-events#金額の扱い)）。

## 状態照会

`GET /payments/:paymentIntentId` を加盟店サーバーから呼び、店舗 API キーを `x-stbl-api-key` に送ります。[OpenAPI 仕様書](pathname:///openapi/#operation/getPayment)と[実装例](/server/retrieve-payment)を参照してください。リクエスト本文はありません。

**この API は公開準備中で、Sandbox への配備前です（2026年11月17日時点）。** 配備までは、認証なしの `GET /payment_status/:paymentIntentId` で状態を確かめてください。

12項目はすべて必須キーです。`paymentIntentId`、`orderId`、`status`、`amountJpy`、`feeJpy`、`netAmountJpy`、`txHash`、`settledAt`、`failedReason`、`payerAddress`、`netAmountDestination`、`createdAt` を返します。`orderId`、`txHash`、`settledAt`、`failedReason`、`payerAddress`、`netAmountDestination` は null を取り得ます。未知キーは無視してください。

- 自店の決済だけを返します。別店舗・別加盟店・不存在は同じ404です。利用停止中・店舗無効でも有効なキーで照会できます。失効キーは拒否します。
- `payerAddress` は支払人のウォレットアドレスで、本人確認結果ではありません。`netAmountDestination` は成立時に記録した取り分の届け先です。旧決済の欠けた記録は埋め直さず null です。非 `settled` では両方 null です。
- `feeJpy`・`netAmountJpy` は `settled` なら実額、実行結果が確認できなければ見積りです。非 `settled` は見積りで、Webhook の非成立通知の `"0"` とは異なります。
- 既定は API キーごとに UTC 毎分600回です。429 `common/rate_limited` の整数秒 `Retry-After` を待って再試行します。制限の確認障害は503 `common/service_unavailable`です。未知のエラーコードは共通フォールバックへ落とします。

既存の `GET /payment_status/:paymentIntentId` と `GET /payment_intents/:paymentIntentId` は認証なしの決済ページ向けです。状態照会応答には金額・手数料・ウォレットを含みません。決済 ID を自社注文の閲覧権限の代わりに使わないでください。

## 状態の値

`settled` だけが成立で、商品の提供や入金の計上はこの状態を根拠にします。値の区分・意味・遷移は[ステータス一覧](/lifecycle/statuses)にあります。値の一覧は [OpenAPI 仕様書](pathname:///openapi/#operation/getPaymentStatus)の `status` にもあります。

未知の値を受け取ったときは、商品の提供や再請求をせず、確認中として扱ってください。

## `failed_reason` の分類コード

`failedReason`（状態照会）と Webhook の `failed_reason` には、失敗の分類コードが入ります。コードの一覧と意味は、[OpenAPI 仕様書](pathname:///openapi/#operation/getPaymentStatus)の `failedReason` にあります。

コードは今後増えることがありますが、既存のコードの意味は変わりません。受け手は値を列挙で厳密に検証せず、**未知の値を、失敗として扱うフォールバックに落としてください。** 次のコードは、扱いが他と違います。

- `nonce_conflict`：結末を特定できていません。注文を失敗として閉じず、保留して[調査へ回します](/lifecycle/edge-cases#送金の結果が確定できないnonce_conflict)。Webhook は届かず、状態照会でだけ見えます。
- `userop_expired`：決済は `failed` ですが、**お金は届いています**。期限内に着金しなかった `expired` とは別の事象です。利用者の JPYC 残高は減っておらず、次の決済に充てられます。
- `merchant_wallet_outdated`：加盟店コンソールで受取ウォレットの「アップデート」が要ります。
- `merchant_suspended`：加盟店の利用停止で終端にした決済です（[加盟店の利用停止](/lifecycle/edge-cases#加盟店の利用停止)）。

`nonce_conflict` を除くどのコードでも、決済は `failed` で終わり、成立していません。

## エラー

エラーの本文は `{ code, details? }` です。エンドポイントごとのエラーコードと対処は、[OpenAPI 仕様書](pathname:///openapi/)の各エンドポイントの応答にあります。

```json
{ "code": "common/invalid_request" }
```

- 分岐には `code` を使い、HTTP ステータスは補助にしてください。**未知のコードは共通のエラー処理へ落としてください。** コードは増えることがあります。
- 表示文言はサーバーが返さないので、加盟店側で決めます。
- 429 が返ったときは、本文の形にかかわらず、間を置いて再試行してください。前段のネットワークで回数を制限したときの本文には `code` が入りません。
- `common/internal`（500）は、同じ `orderId` で再試行しても決済が二重に立つことはありません。
- `payment/order_id_conflict`（409）は、同じ加盟店の別の店舗で使った `orderId` で作成したときのエラーです。同じ値で再試行しても解消しないので、新しい `orderId` で作り直してください（[店舗をまたぐ制約](/server/create-payment#冪等性)）。

返金は決済処理とは別の権限で行います。ownerのコンソール操作と、公開準備中の[加盟店サーバーAPI](/refunds/machine-api)は[返金の提供範囲](/refunds/overview)を参照してください。本番提供開始の案内ではありません。

## 金額・チェーンとトークン

金額は小数を含む円建て10進文字列（例：`"4980.125"`）です。JPYC の最小単位は円 × 10^18 で、API の既存の Jpy 変換精度は小数6桁です。トークンの decimals と API の変換精度は別です。数値型へ変換しないでください。同じ tx に複数の決済や複数の Transfer が含まれる場合があるので、txHash だけで注文を対応付けず、保存した paymentIntentId を使います。

| 環境 | chainId | JPYC コントラクトアドレス |
|---|---|---|
| Sandbox | 実配備設定の確認待ち（未提供） | 未提供。導入担当者へ確認してください |
| 本番 | 未提供 | 未提供 |

Sandbox の稼働 API の chainId／stablecoin の組は未照合です。開発用 Amoy の既存値（80002／`0xe7c3d8c9a439fede00d2600032d5db0be71c3c29`）を Sandbox の値として使わないでください。本番の稼働設定も未照合のため、未検証のアドレスは掲載していません。
