---
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 4
---

# Quick Start

本ガイドの記述どおりに動く接続先で、決済作成・遷移・状態照会を確認する最小手順です。[接続情報](/getting-started/prerequisites)を用意してください。試すときは [Sandbox](/testing/sandbox) を使えます。

## 1. サーバーから決済を作成する

以下はサーバー側で実行する例です。`STBL_PAY_BACKEND` と `STBL_PAY_API_KEY` は対象環境の値を設定します。例の `returnUrl` は、登録したドメインの URL に置き換えてください（条件は[ドメイン登録](/security/domain#returnurl-の条件)）。

```bash
curl --fail-with-body "$STBL_PAY_BACKEND/payment_intents" \
  -H "x-stbl-api-key: $STBL_PAY_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"amountJpy":"4980","orderId":"ord_0001","returnUrl":"https://shop.example.com/orders/ord_0001/return"}'
```

注文と `paymentIntentId` の対応を保存し、応答の `status` を確かめてから `checkoutUrl` をブラウザへ渡します。同じ注文の再試行では同じ `orderId` を使います。再試行で終端の既存決済が返ったときは `checkoutUrl` へ遷移させません。`settled` なら支払いは済んでいます。`nonce_conflict` は結果が確定していないため、自動出荷と自動再請求を止め、決済 ID を添えて[問い合わせ先](/support/troubleshooting#問い合わせ先)へ調査を依頼し、調査の結果を問い合わせへの返答で受け取るまで作り直しません（[送金の結果が確定できない](/lifecycle/edge-cases#送金の結果が確定できないnonce_conflict)）。`failed`・`expired`・`canceled` なら、注文の扱いを確かめてから新しい `orderId` で作り直します（[冪等性](/server/create-payment#冪等性)）。応答のその他の項目は [REST リファレンス](/reference/rest)を参照してください。

## 2. ブラウザを遷移させる

```js
// checkoutUrl は自社サーバーが STBLpay の作成応答から返した値。
window.location.assign(checkoutUrl);
```

API キーを HTML や JavaScript に埋め込まないでください。専用決済ページを iframe や popup に入れず、ページ全体を遷移させます。

## 3. サーバーで状態を確認する

作成時に保存した ID を `PAYMENT_INTENT_ID` に設定して照会します。この API は認証不要です。

```bash
curl --fail-with-body "$STBL_PAY_BACKEND/payment_status/$PAYMENT_INTENT_ID"
```

`status` が `settled` であれば成立です。`signed` や `deposit_confirmed` は処理途中です。照会失敗を決済失敗として扱わないでください。

## 4. 注文処理につなぐ

この例だけでは商品提供の処理は完成していません。以下を実装してください。

- 自社注文の認証・認可、サーバーでの金額計算、CSRF 対策
- Webhook を使う場合（任意。推奨）は、[Webhook 署名検証](/webhooks/signature)と[永続化・重複排除](/webhooks/idempotency)。使わない場合は、状態照会で `settled` を確かめてから確定する
- [サーバーでの完了判定](/lifecycle/completion)と一度だけの商品提供
- 通知欠落時の定期照会と[異常系](/lifecycle/edge-cases)の対応

復帰 URL のクエリを支払い済み判定に使わないでください。
