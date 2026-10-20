---
title: EC サイトへの組み込み準備
sidebar_label: EC サイトへの組み込み準備
sidebar_position: 1
---

# EC サイトへの組み込み準備

加盟店が実装するのは自社サーバーへの作成要求と、専用決済ページへの遷移です。

## 準備するもの

- 自社注文を認証・認可し、サーバーで金額を計算するエンドポイント
- [決済作成 API](/server/create-payment)を呼ぶサーバー処理
- `checkoutUrl` へ遷移する購入ボタン
- 自社注文の状態を表示する復帰ページ

API キーはブラウザへ渡さず、STBLpay API は加盟店サーバーから呼び出します。

パスキー認証と署名は専用決済ページ（加盟店サイトとは別の [origin](/reference/glossary)）の責務です。加盟店ページに iframe・popup・モーダルで決済画面を埋め込まないでください。

次は [決済を開始する](/client/start-payment)を参照してください。
