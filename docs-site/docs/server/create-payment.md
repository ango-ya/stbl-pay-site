---
title: 決済を作成する
sidebar_label: 決済を作成する
sidebar_position: 2
---

# 決済を作成する

「決済を作成する」とは、金額と注文番号を STBLpay に登録し、決済の受付票（[決済意図](/reference/glossary)）を作ってもらうことです。

金額と注文番号は加盟店サーバーで確定します。ブラウザから受け取った金額をそのまま使わず、ログイン利用者がその注文を支払えることを検証してください。

## 作成の流れ

1. 注文を保存し、決済の再試行でも変えない `orderId` を割り当てる。
2. API キーを付けて `POST /payment_intents` を呼ぶ。
3. `paymentIntentId` と注文の対応を永続化する。
4. 返ってきた `checkoutUrl` をブラウザに渡す。

本文と応答の項目ごとの定義は、[OpenAPI 仕様書](pathname:///openapi.yaml)の `POST /payment_intents` にあります。

```js
// order は認可と価格計算を済ませたサーバー側の注文。
const response = await fetch(`${process.env.STBL_PAY_BACKEND}/payment_intents`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-stbl-api-key': process.env.STBL_PAY_API_KEY,
  },
  body: JSON.stringify({
    amountJpy: order.totalJpy, // 10進文字列
    orderId: order.id,
    returnUrl: `https://shop.example.com/orders/${encodeURIComponent(order.id)}/return`,
  }),
});
if (!response.ok) throw new Error(`決済作成失敗: HTTP ${response.status}`);
const payment = await response.json();
```

これは API 呼び出し部分の例です。自社エンドポイントには認証・注文の所有権確認・CSRF 対策を実装し、API エラーは [code による処理](/reference/rest#エラー)へ接続してください。

## 冪等性

同じ店舗から同じ `orderId` で作成し直すと、新規決済ではなく既存の決済が返ります。タイムアウトや二重クリックでも同じ値を使い、再試行ごとに乱数を作らないでください。同じ `orderId` で同時に作成した場合も、エラーにはならず、両方に同じ決済が 201 で返ります。

既存の決済は、期限切れや成立済みなどの[終端](/reference/glossary)に着いていても、そのまま返ります。終端の決済では支払えないため、`checkoutUrl` へ遷移させる前に応答の `status` を確認してください。`settled` なら支払いは済んでいます。`nonce_conflict` は結果が確定していないため、自動出荷と自動再請求を止め、決済 ID を添えて[問い合わせ先](/support/troubleshooting#問い合わせ先)へ調査を依頼し、調査の結果を問い合わせへの返答で受け取るまで作り直しません（[送金の結果が確定できない](/lifecycle/edge-cases#送金の結果が確定できないnonce_conflict)）。`failed`・`expired`・`canceled` なら、注文の扱いを確かめてから、新しい `orderId` で作り直します。

例外として、**加盟店の利用停止が解けたあと**の再作成では、既存の決済が返らないことがあります。なお、利用停止の最中は、決済の作成そのものが 403 `merchant/suspended` で拒否されます。既存の決済が停止で中止済みか、停止の前に作られてまだ送信を開始していないときは、409 `payment/order_terminated` が返ります（`details` は `{ paymentIntentId, status, failedReason }`）。この場合、`checkoutUrl` は返りません。**新しい `orderId` で作り直してください。** それ以外の既存の決済（成立済み、期限切れ、取消済み、送信を開始済みなど）は、従来どおり既存の決済が返ります。利用停止の扱いは [加盟店の利用停止](/lifecycle/edge-cases#加盟店の利用停止)を参照してください。

同じ `orderId` に異なる金額や期限を送っても、既存の決済を更新する操作にはなりません。注文の条件変更や終端後の再決済は、既存決済の `status` が終端になったことを確認してから、別の決済試行として管理します。終端でない間に新しい `orderId` で作ると、利用者がどちらでも支払える状態になり、両方を払うと二重に支払うことになります。加盟店から既存決済を取り消す方法はありません（[キャンセル](/lifecycle/transitions#キャンセル)）。

複数店舗を持つ場合は、注文番号を加盟店内で一意に採番してください。現在の仕様では、一意制約は加盟店単位、既存決済の取得は店舗単位のため、別店舗で同じ番号を使うと、その店舗からは既存の決済を取得できず、500 `common/internal` になります。再試行しても解消しません。

## ドメインの登録

EC の決済を作成するには、加盟店コンソールでドメインを登録している必要があります。未登録だと 409 `merchant/domain_required` が返ります。手順は [ドメイン登録](/security/domain)を参照してください。

## 期限と復帰先

操作期限は応答の `checkoutExpiresAt` で確認します。任意の `merchantExpiresAt` は**着金期限**の上限として効き、操作期限は短くなりません（指定できるのは作成から 3 日より先だけで、操作期限はそれより短いため）。既存決済の期限を延長することもありません。詳細は [状態遷移と期限](/lifecycle/transitions)にあります。

`returnUrl` は登録ドメインの HTTPS URL にし、秘密情報を含めないでください（条件と例は[ドメイン登録](/security/domain#returnurl-の条件)）。復帰は決済成立の証明ではありません。

完全なフィールド定義は [REST リファレンス](/reference/rest)から一次情報を参照してください。
