---
title: REST API リファレンス
sidebar_label: REST API
sidebar_position: 2
---

# REST API リファレンス

このページは、加盟店サーバーが呼ぶ API のメソッド・パス・認証・フィールド・エラーをまとめています。接続先 URL は導入時に STBLpay の担当者へ問い合わせて受け取り（[問い合わせ先](/support/troubleshooting#問い合わせ先)）、公開 URL や localhost の既定値を仮定しないでください。

## エンドポイント一覧

| メソッド | パス | 認証 | 用途 |
|---|---|---|---|
| `POST` | `/payment_intents` | API キー（`x-stbl-api-key`） | [決済を作成する](#決済作成) |
| `GET` | `/payment_status/:paymentIntentId` | なし | [決済の状態を照会する](#状態照会) |

リクエストとレスポンスの本文は JSON です。

## 決済作成

`POST /payment_intents`

決済を作成し、利用者を遷移させる `checkoutUrl` を返します。

### リクエストヘッダー

| ヘッダー | 必須 | 値 |
|---|---|---|
| `x-stbl-api-key` | 必須 | 加盟店コンソールで発行した API キー |
| `Content-Type` | 必須 | `application/json` |

### リクエストボディ

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `amountJpy` | 金額の文字列 | 必須 | 請求額（円） |
| `orderId` | 文字列（最大128文字） | 任意 | 自社の注文 ID。冪等性のキー |
| `returnUrl` | HTTPS URL の文字列 | 任意 | 決済後に利用者が戻る URL |
| `merchantExpiresAt` | 日時の文字列 | 任意 | 決済の期限の上限 |

### フィールドの注意

- `amountJpy` は、10進の数を表す文字列です。先頭ゼロなしの整数部に、任意で小数部が付きます（例：`"4980"`、`"0.5"`）。JSON number ではありません。手数料などの端数も浮動小数点数へ変換せず扱います。
  - `"0"` は受け付けません。0 を超える金額を指定します（400 `common/invalid_request`）。
  - 小数部は6桁までです。超えると 400 `common/invalid_request` です。
  - この API は、金額の上限と下限を独自にはかけていません。支払い時に、利用者のウォレットの金額上限・頻度上限に触れて成立しないことがあります（`failed_reason` は `policy_violation`）。運用上の上限・下限の取り決めは、[問い合わせ先](/support/troubleshooting#問い合わせ先)に確認してください。
- `orderId` は、同じ店舗から同じ値で再作成すると既存の決済を返します。注文ごとに安定した値を指定してください。省略した場合、この注文識別子による冪等性は使えません。複数店舗では加盟店全体で一意に採番してください（[店舗をまたぐ制約](/server/create-payment#冪等性)）。
- `returnUrl` は、次の条件をすべて満たす必要があります。満たさないと決済は作成されません。`https` でない URL は 400 `common/invalid_request` です。ただし `http://localhost`・`http://127.0.0.1`・`http://[::1]` は形式の検査を通るため、403 `merchant/origin_mismatch` になります。`https` で、ほかの条件に合わないときも 403 `merchant/origin_mismatch` です。
  - スキームは `https` です。`http` は使えません。`http://localhost` のような開発用の URL も使えません（403 `merchant/origin_mismatch`）。
  - ポート番号を付けられません（`https://shop.example.com:8443/` は不可）。
  - `user:pass@` のような userinfo を含められません。
  - ホスト名が、加盟店コンソールで登録したドメインと**完全に一致**します（大文字小文字は区別しません）。サブドメインは別のドメインとして扱うため、`shop.example.com` を登録したときに `www.shop.example.com` は使えません。ドメインの登録は[ドメイン登録](/security/domain)を参照してください。
  - パスとクエリには制限がありません（例：`https://shop.example.com/orders/ord_0001/return`）。

  利用者が「ストアに戻る」リンクを押すと、`returnUrl` に `stbl_pay_intent` クエリが付いて開きます（例：`https://shop.example.com/orders/ord_0001/return?stbl_pay_intent=pi_xxx`）。値は決済 ID です。`returnUrl` に同じ名前のクエリがあると上書きされます。
- `merchantExpiresAt` は、サーバーが決める期限を短くする上限として使われます。UTC の `Z` で終わる形だけを受け付けます（例：`"2026-10-20T03:00:00Z"`）。`+09:00` のようなオフセット付きは 400 `common/invalid_request` です。同じ `orderId` で再作成しても、最初に受け取った値は上書きされません。[期限の扱い](/lifecycle/transitions)を参照してください。

### レスポンス

成功すると 201（同じ `orderId` で既存の決済を返すときも 201） で次の JSON を返します。

| フィールド | 型 | 説明 |
|---|---|---|
| `paymentIntentId` | 決済 ID の文字列 | 決済 ID。自社の注文と結び付けて保存する |
| `checkoutUrl` | HTTPS URL の文字列 | 利用者をトップレベル遷移させる決済ページの URL |
| `status` | [状態の値](#状態の値) | 新しく作成したときは `created` |
| `amountJpy` | 金額の文字列 | 請求額 |
| `feeJpy` | 金額の文字列 | 手数料 |
| `netAmountJpy` | 金額の文字列 | 加盟店の受取額（`amountJpy` − `feeJpy`） |
| `checkoutExpiresAt` | 日時の文字列 | 決済ページの期限 |
| `createdAt` | 日時の文字列 | 決済の作成日時 |

`status` が `created` でも、決済は成立していません。成立は Webhook か状態照会で確かめます。

### 主なエラー

`merchant/origin_mismatch`、`merchant/domain_required`、`merchant/suspended`、`store/disabled`、`payment/order_terminated`、`payment/expires_at_too_soon`、`auth/api_key_invalid`、`common/invalid_request`、`common/internal`。意味と対処は[エラー](#エラー)を参照してください。

### 例

リクエスト：

```http
POST /payment_intents
x-stbl-api-key: stblpay_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "amountJpy": "4980",
  "orderId": "ord_0001",
  "returnUrl": "https://shop.example.com/orders/ord_0001/return"
}
```

レスポンス（値は例です）：

```json
{
  "paymentIntentId": "pi_0123456789abcdef",
  "checkoutUrl": "https://checkout.example/checkout/pi_0123456789abcdef",
  "status": "created",
  "amountJpy": "4980",
  "feeJpy": "49.8",
  "netAmountJpy": "4930.2",
  "checkoutExpiresAt": "2026-10-20T03:00:00.000Z",
  "createdAt": "2026-10-19T03:00:00.000Z"
}
```

## 状態照会

`GET /payment_status/:paymentIntentId`

決済の現在の状態を返します。**認証はありません。** API キーや Authorization ヘッダーは不要です。

### パスパラメーター

| パラメーター | 型 | 説明 |
|---|---|---|
| `paymentIntentId` | 決済 ID の文字列 | 決済作成で受け取った `paymentIntentId` |

### レスポンス

成功すると 200 で次の JSON を返します。

| フィールド | 型 | 説明 |
|---|---|---|
| `paymentIntentId` | 決済 ID の文字列 | 照会した決済 ID |
| `status` | [状態の値](#状態の値) | 現在の状態 |
| `txHash` | `0x` と64桁の16進の文字列、または null | 送金のトランザクション |
| `failedReason` | 文字列、または null | 失敗の[分類コード](#failed_reason-の分類コード) |
| `returnUrl` | HTTPS URL の文字列、または null | 作成時に指定した `returnUrl` |
| `settledAt` | 日時の文字列、または null | 成立した日時。`settled` 以外は null |

この応答に金額・手数料・ウォレットは含まれません。決済 ID は秘密ではなく、自社注文へのアクセス権限の代わりには使えません。

### 主なエラー

`payment/not_found`（404、存在しない決済 ID）、`common/invalid_request`（400、決済 ID の[形式](#値の形式)が違う）。意味と対処は[エラー](#エラー)を参照してください。

### 例

```http
GET /payment_status/pi_0123456789abcdef
```

```json
{
  "paymentIntentId": "pi_0123456789abcdef",
  "status": "settled",
  "txHash": "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "failedReason": null,
  "returnUrl": "https://shop.example.com/orders/ord_0001/return",
  "settledAt": "2026-10-19T03:05:00.000Z"
}
```

## 状態の値

`status` は次の12個のいずれかです。`settled` だけが成立で、商品の提供や入金の計上はこの状態を根拠にします。区分の意味と遷移は[ステータス一覧](/lifecycle/statuses)を参照してください。

| 値 | 区分 | 一言の意味 |
|---|---|---|
| `created` | 途中 | 決済を作成した。署名を待っている |
| `signed` | 途中 | 利用者の署名が済んだ |
| `issue_pending` | 途中 | 利用者が JPYC の発行手続きを始めた |
| `deposit_seen` | 途中 | 着金を検知した。確定を待っている |
| `deposit_confirmed` | 途中 | 着金（または残高）を確認した。決済の実行前 |
| `deploying` | 途中 | 利用者のウォレットを作成している |
| `executing` | 途中 | 決済を実行した。結果を確認している |
| `settled` | 成立 | 決済が成立し、加盟店へ送金された |
| `canceled` | 成立しなかった | 決済が取り消された |
| `expired` | 成立しなかった | 期限内に着金がなく終了した |
| `failed` | 成立しなかった | 決済が失敗した。理由は `failedReason` |
| `nonce_conflict` | 要確認 | 結末を特定できなかった。成立とも失敗とも判断しない |

未知の値を受け取ったときは、商品の提供や再請求をせず、確認中として扱ってください。

## 値の形式

| 値 | 形式 | 例 |
|---|---|---|
| 決済 ID（`paymentIntentId`） | `pi_` に、小文字の16進が8〜32桁 | `pi_0123456789abcdef` |
| イベント ID（Webhook の `id`） | `evt_` に、小文字の16進が8〜32桁 | `evt_0123456789abcdef` |
| `txHash` | `0x` に、小文字の16進が64桁 | `0x` ＋ 64桁 |
| API キー | `stblpay_` に、英数字・`-`・`_` の43文字 | `stblpay_` ＋ 43文字 |
| 日時 | UTC の `Z` で終わる ISO 8601。応答はミリ秒まで付く。リクエストではミリ秒を省略できる | `2026-10-20T03:00:00.000Z` |
| 金額（`amountJpy` など） | 10進の数の文字列。先頭ゼロなし、小数部は任意 | `"4980"` |

[テスト通知](/reference/webhook-events#テスト通知)の ID は、`evt_test_` と `pi_test_` に小文字の16進が24桁続く形で、上の形式には合いません。

## `failed_reason` の分類コード

`failedReason`（状態照会）と Webhook の `failed_reason` に入る値は、次の表のコードのいずれかです。生のチェーンのエラー文字列は入りません。**型は文字列のまま**なので、値が増えても旧クライアントの検証は落ちません。受け手は **未知の値を、失敗として扱うフォールバックに落としてください。** 発行体の取引可否判断の理由は入りません。

| コード | 意味 |
|---|---|
| `userop_expired` | 着金または残高の充足は確認できたが、決済を実行できる時刻を過ぎていた。**お金は届いている**。`expired`（期限内に着金しなかった）とは別の事象で、`payment.failed` で届く。利用者の JPYC 残高は減っておらず、次の決済に充てられる |
| `deposit_recipient_mismatch` | 着金の宛先が、決済で想定した宛先と違う |
| `wallet_deploy_failed` | 利用者のウォレットの作成に失敗した（実行の失敗、または試行の上限） |
| `missing_signed_userop` | 実行に必要な署名済みの操作が無かった |
| `insufficient_balance` | 支払人の残高が足りない |
| `policy_violation` | 支払人のウォレットの金額上限・頻度上限に触れた |
| `not_pay_call` / `not_allowed_call` | 許可された形の支払い操作ではなかった |
| `fee_amount_mismatch` | 手数料の額が合わない |
| `fee_not_collected` | 手数料が徴収されていない |
| `merchant_wallet_outdated` | 加盟店の受取ウォレットの実装が古く、猶予を過ぎている。加盟店コンソールの「アップデート」が要る |
| `unexpected_implementation` | ウォレットの実装が想定と違う |
| `userop_reverted` | 上のどれにも当てはまらない、支払い操作の失敗 |
| `nonce_conflict` | 結末を特定できなかった（状態も `nonce_conflict`）。**Webhook は届かず、状態照会でだけ見える**。[調査へ回す](/lifecycle/edge-cases) |
| `merchant_suspended` | 加盟店の利用停止で、送信を開始していない決済を終端にした。入金済みの JPYC は利用者のウォレットに残る。[加盟店の利用停止](/lifecycle/edge-cases#加盟店の利用停止) |
| `unclassified` | まだ分類していない失敗 |

どのコードでも、決済は `failed` で終わり、成立していません。コードは、注文を失敗として終了したうえで、調査や利用者への案内を分けるための手掛かりです。コードの意味は変わらず、増えることがあります。

## エラー

サーバーのエラー形式は `{ code, details? }` です。たとえば次の形です。

```json
{ "code": "common/invalid_request" }
```

加盟店の設定・利用停止に関するコードは次のとおりです。

| `code` | HTTP | 意味と対処 |
|---|---|---|
| `merchant/domain_required` | 409 | EC の決済にはドメインの登録が必要。加盟店コンソールで登録する（[ドメイン登録](/security/domain)） |
| `merchant/suspended` | 403 | 加盟店が利用停止中。決済を作成できない。再開を待つ |
| `merchant/origin_mismatch` | 403 | `returnUrl` が登録ドメインの条件に合わない。[`returnUrl` の条件](#フィールドの注意)を満たす URL にする |
| `payment/order_terminated` | 409 | 同じ `orderId` の既存の決済が停止で中止済み、または停止前に作られてまだ送信していない。`details` は `{ paymentIntentId, status, failedReason }`。新しい `orderId` で作り直す |

[加盟店の利用停止](/lifecycle/edge-cases#加盟店の利用停止)を参照してください。

`POST /payment_intents` が返しうるエラーは次のとおりです（上の表のものを除く）。

| `code` | HTTP | 意味と対処 |
|---|---|---|
| `auth/api_key_invalid` | 401 | API キーが無効、失効済み、または送られていない。キーを確認する |
| `store/disabled` | 409 | 店舗が無効化されている。加盟店コンソールで店舗の状態を確認する |
| `payment/expires_at_too_soon` | 400 | `merchantExpiresAt` が近すぎる（作成時点から3日以内に切れる指定）。[期限の扱い](/lifecycle/transitions)を参照し、より後の時刻を指定する |
| `common/invalid_request` | 400 | リクエストの形式が正しくない（フィールドの型・形式の違反）。入力を直す。`details.issues` に、違反ごとの配列が入る（各要素の `path` が該当フィールド、`message` が理由） |
| `common/internal` | 500 | サーバー側の障害。同じ `orderId` で再試行しても決済が二重に立つことはない |

状態照会（`GET /payment_status/:paymentIntentId`）は、存在しない決済 ID に `payment/not_found`（404）を返します。決済 ID の形式（`pi_` に小文字の16進が8〜32桁）に合わないときは、存在を確かめる前に `common/invalid_request`（400）を返します。

429 が返ったときは、ボディの形にかかわらず、間を置いて再試行してください。決済作成と状態照会には、アプリ側の回数制限はありません。ただし、前段のネットワークで回数を制限することがあり、そのときのボディには `code` が入りません。

分岐には `code` を使い、HTTP ステータスは補助にしてください。**未知のコードは共通のエラー処理へ落としてください。** コードは増えることがあります。`details` は任意の構造化情報です。表示文言は加盟店側で決めます。

返金は加盟店コンソールの機能で、加盟店サーバーから呼べる返金 API はありません（[返金の提供範囲](/refunds/overview)）。
