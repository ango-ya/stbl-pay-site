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
