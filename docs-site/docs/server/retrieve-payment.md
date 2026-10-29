---
title: 決済状態を照会する
sidebar_label: 決済状態を照会する
sidebar_position: 3
---

# 決済状態を照会する

加盟店サーバーから、保存済みの `paymentIntentId` で現在の状態を[照会](/reference/glossary)します。**API 認証は不要**です。

```js
const response = await fetch(
  `${process.env.STBL_PAY_BACKEND}/payment_status/${encodeURIComponent(paymentIntentId)}`,
);
if (!response.ok) throw new Error(`状態照会失敗: HTTP ${response.status}`);
const payment = await response.json();
```

自社の注文表示 API にはログインと注文の所有権確認が必要です。ブラウザが渡した任意の決済 ID ではなく、注文に保存した ID を使います。

## 応答の扱い

応答のフィールドは [REST リファレンス](/reference/rest#状態照会)にまとめています。項目ごとの定義は、[OpenAPI 仕様書](pathname:///openapi.yaml)の `PaymentStatusView` にあります。金額や手数料はこの応答に含まれません。照会失敗やタイムアウトを、決済の `failed` として扱わないでください。

| 状態 | 注文側の処理 |
|---|---|
| `settled` | 注文との対応を確認し、一度だけ支払い済みにする |
| `canceled` / `expired` / `failed` | 未提供の注文を業務ルールに沿って終了する |
| `nonce_conflict` | 結末を特定できないため、自動出荷・自動再請求を止め、決済 ID を添えて[問い合わせ先](/support/troubleshooting#問い合わせ先)へ調査を依頼する |
| それ以外の6状態 | 決済途中として照会を継続する |

Webhook を受けたときの確定照会と、通知を取りこぼした未確定注文の定期突合に使います。ブラウザが戻らなくても確認を続けてください。

[完了判定](/lifecycle/completion)と[状態の意味](/lifecycle/statuses)も参照してください。
