---
title: 決済状態を照会する
description: "保存済みの決済 ID で、決済の現在の状態を照会する方法を説明します。店舗 API キーを使います。Webhook を補う状態確認に使える、加盟店サーバー向けです。"
sidebar_label: 決済状態を照会する
sidebar_position: 3
---

# 決済状態を照会する

加盟店サーバーから、保存済みの `paymentIntentId` で現在の状態を[照会](/reference/glossary)します。店舗 API キーを `x-stbl-api-key` ヘッダーで送ります。

```js
const response = await fetch(
  `${process.env.STBL_PAY_BACKEND}/payments/${encodeURIComponent(paymentIntentId)}`,
  { headers: { "x-stbl-api-key": process.env.STBL_PAY_API_KEY } },
);
if (!response.ok) throw new Error(`状態照会失敗: HTTP ${response.status}`);
const payment = await response.json();
```

自社の注文表示 API にはログインと注文の所有権確認が必要です。ブラウザが渡した任意の決済 ID ではなく、注文に保存した ID を使います。

## 応答の扱い

応答のフィールドは [REST リファレンス](/reference/rest#状態照会)にまとめています。項目ごとの定義は、[OpenAPI 仕様書](pathname:///openapi/#operation/getPayment)の `PaymentLookupResponse` にあります。金額・手数料・アドレスを含む12項目を返します。照会失敗やタイムアウトを、決済の `failed` として扱わないでください。

| 状態 | 注文側の処理 |
|---|---|
| `settled` | 注文との対応を確認し、一度だけ支払い済みにする |
| `canceled` / `expired` / `failed` | 未提供の注文を業務ルールに沿って終了する |
| `nonce_conflict` | 結末を特定できないため、自動出荷・自動再請求を止め、決済 ID を添えて[問い合わせ先](/support/troubleshooting#問い合わせ先)へ調査を依頼する |
| それ以外の6状態 | 決済途中として照会を継続する |

Webhook を受けたときの確定照会と、通知を取りこぼした未確定注文の定期突合に使います。ブラウザが戻らなくても確認を続けてください。

[完了判定](/lifecycle/completion)と[状態の意味](/lifecycle/statuses)も参照してください。

## 照会の境界

自店の決済1件だけを取得します。別店舗・別加盟店・不存在はいずれも404 `common/not_found`です。一覧や `orderId` で照会する API はありません。加盟店の利用停止中・店舗無効でも有効なキーで照会できますが、失効キーは401 `auth/api_key_invalid`です。

既定の上限は API キーごとに UTC の毎分境界で600回です。複数の API タスクで共有し、404や不正 ID も数えます。分境界をまたぐ短時間には最大1200回通る性質があります。429 `common/rate_limited` では整数秒の `Retry-After` を待ちます。頻度制限を確認できない場合は503 `common/service_unavailable`です。照会エラーで注文を失敗にせず、間を置いて再試行します。

`payerAddress` と `netAmountDestination` は `settled` で記録がある場合だけ値を返します。旧決済は埋め直さず null のままです。前者は支払人ウォレットのアドレスで、本人確認結果ではありません。後者はその決済成立時に記録した取り分の届け先であり、現在の設定から補完しません。照会は読取専用です。既存の返金機能は引き続き利用できます（[返金の提供範囲](/refunds/overview)）。

`feeJpy` と `netAmountJpy` は `settled` では実額、実行結果を確認できない旧記録等では作成時の見積りです。非 `settled` でも見積りを返し、非成立 Webhook の `"0"` とは異なります。未知のレスポンスキーは無視してください。
