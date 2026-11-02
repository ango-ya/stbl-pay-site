---
title: Sandbox
sidebar_label: Sandbox
sidebar_position: 1
---

# Sandbox

組み込みを試すための環境です。本番とは別の環境で、JPYC EX の部分はモックに置き換えてあります。

| 対象 | URL |
|---|---|
| API のベース URL | `https://api.sandbox.stbl-pay.com` |
| 加盟店コンソール | https://merchant.sandbox.stbl-pay.com/ |
| 決済ページ | `https://app.sandbox.stbl-pay.com`（URL は作成応答の `checkoutUrl` を使う） |

## 始め方

1. 加盟店コンソールの[登録ページ](https://merchant.sandbox.stbl-pay.com/register)で、パスキーを使って加盟店を登録します。紹介コードは任意です。
2. [準備](/getting-started/prerequisites#加盟店側の準備)のとおり、ネットショップのお店を作り、API キーの発行とドメインの登録をします。
3. [Quick Start](/getting-started/quickstart) の `STBL_PAY_BACKEND` に `https://api.sandbox.stbl-pay.com` を入れて、決済の作成から状態照会までを試します。

API キーなどの値は、本番と Sandbox で別々に管理してください（[API キー](/security/api-keys)）。動作の確認項目は[テストシナリオ](/testing/scenarios)にあります。

## 複数の環境とローカル開発

ドメイン、Webhook の送信先、署名鍵は、加盟店に 1 つずつです。開発環境と検証環境のように、Sandbox につなぐ環境が複数あって、それぞれのドメインと Webhook を使い分けたいときは、環境ごとに加盟店を登録することをおすすめします。代わりに 1 つの加盟店で済ませるなら、`orderId` に環境の接頭辞（例：`dev-`・`stg-`）を付け、Webhook を共通の受け口で受けて、署名を検証してから接頭辞で各環境へ振り分けます。

`returnUrl` は Sandbox でも [条件](/security/domain#returnurl-の条件)が同じで、`localhost` や `http://`、443 以外のポートを付けた URL は使えません。ローカルで動かしている環境で決済のあとに戻るところまで試すには、トンネルなどで公開した URL のホスト名をドメインに登録するか、公開した環境にデプロイして試します。`returnUrl` を省けば、決済の作成から成立までは試せます。戻り先の処理は、決済が終端になったあとで、ローカルの戻り先ページに `?stbl_pay_intent=<paymentIntentId>` を付けて直接開けば試せます（決済ページから移る動きそのものは試せません）。
