---
title: 既知の制限
description: "STBLpay の既知の制限をまとめています。返金の経路など、仕様と実装と本番提供の状態を区別して確認できる、導入を検討する加盟店向けです。"
sidebar_label: 既知の制限
sidebar_position: 3
---

# 既知の制限

本サイトは仕様の説明です。仕様・実装・本番提供の状態を同じものとして扱いません。

- **返金**：ownerのコンソール操作と、公開準備中の[加盟店サーバーAPI](/refunds/machine-api)。本番提供開始の案内ではない
- **Sandbox**：JPYC EX の部分はモック（[Sandbox](/testing/sandbox)）
- **決済の完了**：Webhook の配信の成否やブラウザの復帰とは別に決まる
- **`nonce_conflict`**：結末を特定できない終端。通知はなく、照会と調査が必要
- **複数アカウントでの管理・WooCommerce プラグイン**：1st リリースでは提供しない（[今後の予定](/support/roadmap)）
- **公開 URL・配布物**：実在や利用可否を確認できていない URL は、既定値として案内しない

提供環境の挙動が本サイトの記述と異なる場合は、[問い合わせ先](/support/troubleshooting#問い合わせ先)に確認してから検証してください。
