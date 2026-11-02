---
title: REST API リファレンス
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
| `GET` | `/payment_status/:paymentIntentId` | なし | [決済の状態を照会する](#状態照会) |

リクエストとレスポンスの本文は JSON で、フィールドは camelCase です。

## 決済作成

`POST /payment_intents` で決済を作成し、利用者を遷移させる `checkoutUrl` を受け取ります。項目・エラー・例は [OpenAPI 仕様書の「決済を作成する」](pathname:///openapi/#operation/createPaymentIntent)にあります。

- 金額（`amountJpy` など）は、JSON number ではなく 10 進の文字列です（例：`"4980"`）。手数料などの端数も、浮動小数点数へ変換せずに扱ってください。API は金額の上限・下限をかけていません。運用上の取り決めは[問い合わせ先](/support/troubleshooting#問い合わせ先)に確認してください。
- `orderId` は冪等性のキーです。同じ店舗から同じ値で呼ぶと、既存の決済を返します。複数店舗では加盟店全体で一意に採番してください（[店舗をまたぐ制約](/server/create-payment#冪等性)）。
- `returnUrl` のホスト名は、加盟店コンソールで登録したドメインと完全に一致させます（[ドメイン登録](/security/domain)）。決済が終端に着くと、決済ページに戻るリンク（成立したときは「ショップに戻る」、それ以外の終端では「お支払い先に戻る」）が出ます。利用者が押すと、`returnUrl` に `stbl_pay_intent` クエリ（値は決済 ID）が付いて開きます。`returnUrl` に同じ名前のクエリがあると上書きされます。
- `merchantExpiresAt` は着金期限の上限です（[期限の扱い](/lifecycle/transitions)）。
- 応答の `status` が `created` でも、決済は成立していません。成立は Webhook か状態照会で確かめます。
- 応答の `feeJpy` と `netAmountJpy` は見積りです。入金の計上には `payment.settled` の `net_received_jpy` を使います（[金額の扱い](/reference/webhook-events#金額の扱い)）。

## 状態照会

`GET /payment_status/:paymentIntentId` で決済の現在の状態を受け取ります。項目・エラー・例は [OpenAPI 仕様書の「決済の状態を照会する」](pathname:///openapi/#operation/getPaymentStatus)にあります。

- **認証はありません。** API キーや Authorization ヘッダーは不要です。
- 決済 ID は秘密ではありません。自社の注文を閲覧する権限の代わりには使わないでください。
- この応答に金額・手数料・ウォレットは含まれません。

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
- `common/internal`（500）は、同じ `orderId` で再試行しても決済が二重に立つことはありません。ただし、別の店舗で使った `orderId` でもこのエラーになり、こちらは再試行しても解消しません（[店舗をまたぐ制約](/server/create-payment#冪等性)）。

返金は加盟店コンソールの機能で、加盟店サーバーから呼べる返金 API はありません（[返金の提供範囲](/refunds/overview)）。
