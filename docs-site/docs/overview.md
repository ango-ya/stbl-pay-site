---
id: overview
title: STBLpay とは
sidebar_label: 概要
sidebar_position: 1
slug: /
---

<div className="brand-band">
  <img src={require('@site/static/img/logo-wordmark-suteburu-black.png').default} alt="すてぶるペイ" />
  <span>円で払い、ステーブルコインで受け取る決済を EC に組み込むための加盟店向けガイド</span>
</div>

# STBLpay とは

このガイドは、EC サイトに STBLpay を組み込む加盟店の開発者と運用担当向けです。

STBLpay（すてぶるペイ）は、銀行振込による日本円の支払いと JPYC の受け取りを EC サイトに組み込むためのサービスです。利用者は専用決済ページでパスキーを使って支払いを承認します。JPYC 残高が足りる場合は残高から支払います。

## 加盟店がやるのは 3 つ

1. **サーバーで決済を作る。** 注文を確定して金額をサーバーで計算し、API で決済を作成します。例：注文 `ord_0001`、4,980 円の決済を作る。詳しくは[決済を作成する](/server/create-payment)。
2. **返ってきた `checkoutUrl` へ利用者を移動させる。** 例：「支払う」ボタンを押した利用者のブラウザを、`checkoutUrl` へ遷移させる。詳しくは[決済を開始する](/client/start-payment)。
3. **サーバーで結果を受け取る。** Webhook（署名を検証する）か[状態照会](/server/retrieve-payment)で結果を確かめ、注文を更新します。Webhook の設定は任意です。例：成立を確かめたら、注文を「支払い済み」にして商品を一度だけ提供する。詳しくは[完了判定](/lifecycle/completion)と[Webhook](/webhooks/events)。

それ以外は、次のとおり STBLpay と利用者が行います。

| 担い手 | やること | 例 |
|---|---|---|
| STBLpay | 決済ページの提供 | 利用者がパスキーで支払いを承認する画面 |
| STBLpay | 加盟店コンソールの提供 | API キーの発行、Webhook の設定、返金の承認 |
| 利用者 | JPYC の発行の申し込み | JPYC EX の画面で、自分で JPYC の発行を申し込み、銀行振込で円を払い込む |

## このサイトの対象と基準

| 対象 | 本サイトでの扱い |
|---|---|
| 決済 API・状態・Webhook | 本ガイドに載せている連携内容 |
| 返金 | 加盟店コンソールから owner がパスキーで承認する経路のみ。加盟店サーバーから呼べる返金 API は無い |
| Sandbox | 準備中（[Sandbox](/testing/sandbox)） |
| 複数アカウントでの管理・WooCommerce プラグイン | 1st リリースのあとに提供予定（[今後の予定](/support/roadmap)） |

提供状況と既知の制約は[提供範囲と制約](/support/limitations)にまとめています。

## 最初に読むもの

1. [決済フロー](/getting-started/payment-flow)、[お金の流れ](/getting-started/money-flow)、[責務の分担](/getting-started/responsibilities)
2. [接続の準備](/getting-started/prerequisites)と[Quick Start](/getting-started/quickstart)
3. [完了判定](/lifecycle/completion)と[Webhook](/webhooks/events)

返金は [提供範囲](/refunds/overview)を参照してください。
