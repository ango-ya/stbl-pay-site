---
title: 認証
sidebar_label: 認証
sidebar_position: 1
---

# 認証

決済作成 API は加盟店サーバーから呼び出し、API キーを次のヘッダで送ります。

```http
x-stbl-api-key: <環境ごとに発行された API キー>
```

API キーは店舗ごとに発行されます。形式は `stblpay_` に 43 文字の base64url が続く文字列です。発行・失効の手順と、1 店舗あたり有効 10 本までという上限は [API キーの管理](/security/api-keys)を参照してください。

`Authorization: Bearer` は STBLpay の API キーの送り方ではありません。Sandbox の入口に Basic 認証などがある場合も、API の認証とは分けて設定します。

`GET /payment_status/:paymentIntentId` は認証なしです。取得した決済 ID を、自社注文の閲覧認可に流用しないでください。

## キーとエラーの扱い

API キーはサーバーのシークレット管理基盤に保管し、ブラウザ、HTML、リポジトリ、アクセスログへ出さないでください。環境の URL とキーをセットで管理します。

失敗時は `{ code, details? }` を読み、[エラー](/reference/rest#エラー)の `code` に従って処理します。認証・設定の誤りを無制限に再試行しないでください。決済作成の通信結果が不明な場合は同じ `orderId` を使います。

次は [決済作成](/server/create-payment)を参照してください。
