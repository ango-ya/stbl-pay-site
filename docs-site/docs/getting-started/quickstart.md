---
title: Quick Start
description: "決済の作成、遷移、状態照会を確かめる最小手順です。接続情報を用意して Sandbox で試せる、JPYC 決済を最短で動かしたい開発者向けです。"
sidebar_label: Quick Start
sidebar_position: 4
---

# Quick Start

[Sandbox](/testing/sandbox) で加盟店を登録し、API キーを発行して、最初の決済を作るまでの手順です。本番も同じ手順で、URL とキーを本番のものに替えるだけです（[環境と URL](/#環境と-url)）。

## 1. Sandbox で加盟店を登録する

加盟店コンソールの[登録ページ](https://merchant.sandbox.stbl-pay.com/register)で、パスキーを使って登録します。紹介コードは任意です。

## 2. ネットショップのお店を作る

メニューの「お店と QR コード」で「お店をつくる」を押し、お店の種類に「ネットショップ」を選びます。API キー・ドメイン・Webhook の設定は、このお店の「組み込みの準備」タブにあります。お店の種類はあとから変えられません（[準備](/getting-started/prerequisites#加盟店側の準備)）。

## 3. API キーを発行する

「組み込みの準備」タブの「お支払いを作るための鍵」で「API キーを発行」を押します。**キーは発行したときに一度だけ表示されます。** その場でサーバーの環境変数に保存してください。

```bash
export STBL_PAY_BACKEND=https://api.sandbox.stbl-pay.com
export STBL_PAY_API_KEY=stblpay_...   # 発行したキー
```

キーはブラウザや Git に出さず、サーバーだけで使います（[API キーの管理](/security/api-keys)）。

## 4. ドメインを登録する

同じタブのドメインの区画で、決済後に戻るページのホスト名（例：`shop.example.com`）を登録します。**未登録だと決済を作れません**（409 `merchant/domain_required`）。ローカル環境で試すときは [複数の環境とローカル開発](/testing/sandbox#複数の環境とローカル開発)を参照してください。

## 5. サーバーから決済を作成する

`returnUrl` は、登録したドメインの URL に置き換えます（[条件](/security/domain#returnurl-の条件)）。

```bash
curl --fail-with-body "$STBL_PAY_BACKEND/payment_intents" \
  -H "x-stbl-api-key: $STBL_PAY_API_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"amountJpy":"4980","orderId":"ord_0001","returnUrl":"https://shop.example.com/orders/ord_0001/return"}'
```

注文と `paymentIntentId` の対応を保存し、応答の `status` を確かめてから `checkoutUrl` をブラウザへ渡します。通信の再送では同じ `orderId` を使います。再試行で終端の既存決済が返ったときは `checkoutUrl` へ遷移させません。`settled` なら支払いは済んでいます。`nonce_conflict` は結果が確定していないため、自動出荷と自動再請求を止め、決済 ID を添えて[問い合わせ先](/support/troubleshooting#問い合わせ先)へ調査を依頼し、調査の結果を問い合わせへの返答で受け取るまで作り直しません（[送金の結果が確定できない](/lifecycle/edge-cases#送金の結果が確定できないnonce_conflict)）。`failed`・`expired`・`canceled` なら、注文の扱いを確かめてから新しい `orderId` で作り直します（[冪等性](/server/create-payment#冪等性)）。応答のその他の項目は [REST リファレンス](/reference/rest)を参照してください。

## 6. ブラウザを決済ページへ移す

```js
// checkoutUrl は自社サーバーが STBLpay の作成応答から返した値。
window.location.assign(checkoutUrl);
```

API キーを HTML や JavaScript に埋め込まないでください。専用決済ページを iframe や popup に入れず、ページ全体を遷移させます。Sandbox の決済ページで、利用者としてパスキーで支払いを承認します。

## 7. サーバーで状態を確認する

作成時に保存した ID を `PAYMENT_INTENT_ID` に設定して照会します。この API は認証不要です。

```bash
curl --fail-with-body "$STBL_PAY_BACKEND/payment_status/$PAYMENT_INTENT_ID"
```

`status` が `settled` であれば成立です。`signed` や `deposit_confirmed` は処理途中です。照会失敗を決済失敗として扱わないでください。

## 8. Webhook を設定する

支払いの結果を受け取るため、EC サイトでは通常設定します。「組み込みの準備」タブの「お支払い完了のお知らせ先」に受信先の URL を設定します。署名鍵は初回の設定時に一度だけ表示されるので、API キーと同じくサーバーに保存します。「テスト送信」で受信を確かめられます（[Webhook](/webhooks/events)、[署名検証](/webhooks/signature)）。

## 9. 注文処理につなぐ

この例だけでは商品提供の処理は完成していません。以下を実装し、[テストシナリオ](/testing/scenarios)で確かめてください。

- 自社注文の認証・認可、サーバーでの金額計算、CSRF 対策
- Webhook の[署名検証](/webhooks/signature)と[永続化・重複排除](/webhooks/idempotency)。理由があって Webhook を使わない場合は、状態照会で `settled` を確かめてから確定する
- [サーバーでの完了判定](/lifecycle/completion)と一度だけの商品提供
- 通知欠落時の定期照会と[異常系](/lifecycle/edge-cases)の対応

復帰 URL のクエリを支払い済み判定に使わないでください。

## 10. 本番へ切り替える

本番の加盟店コンソールで手順 1〜4（と 8）をやり直し、`STBL_PAY_BACKEND` と `STBL_PAY_API_KEY` を本番の値に替えます。キー・ドメイン・Webhook は環境ごとに別に設定します。本番の URL は、公開後に[環境と URL](/#環境と-url)で案内します。
