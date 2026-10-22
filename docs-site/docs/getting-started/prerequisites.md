---
title: 準備
sidebar_label: 準備
sidebar_position: 3
---

# 準備

語の意味は[用語集](/reference/glossary)にあります。

このガイドは、本ガイドの記述どおりに動く環境を対象にします。接続前に、その環境のバージョンと利用できる機能を[問い合わせ先](/support/troubleshooting#問い合わせ先)に確認してください。

## 接続情報

| 情報 | 用途 |
|---|---|
| API のベース URL | サーバー間の決済作成・状態照会 |
| 加盟店の API キー | 決済作成の `x-stbl-api-key` ヘッダ。店舗ごとに、加盟店コンソールで発行する |
| 加盟店の登録ドメイン（[origin](/reference/glossary)） | `returnUrl` の検証 |
| Webhook 受信先と署名鍵 | サーバーでの結果通知受信 |

ブラウザへ API キーを渡さないでください。加盟店が試す環境は準備中です（[Sandbox](/testing/sandbox)）。決済ページの URL は作成応答から取得します。

## 加盟店側の準備

1. 注文を認証・認可し、金額をサーバーで計算する。
2. 注文と決済 ID の対応を保存する DB を用意する。
3. 決済後に戻るページを用意する（URL の条件と例は[ドメイン登録](/security/domain#returnurl-の条件)）。
4. HTTPS の Webhook 受信先で [raw body](/reference/glossary)（受け取ったままの本文）を保持できるようにする。URL は直接 `POST` を受けられる最終 URL にする。HTTPS のみ、ユーザー名・パスワード（[userinfo](/reference/glossary)）を含めない、内部アドレスに解決されない、リダイレクト（`3xx`）は追わない（[送信先 URL の条件](/webhooks/retry#送信先-url-の条件)）。
5. 署名検証、受信イベントの永続化、重複排除、注文の定期[突合](/reference/glossary)を実装する。
