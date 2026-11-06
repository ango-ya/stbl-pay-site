---
title: 決済を開始する
description: "決済を開始する方法を説明します。自社サーバーで決済 ID と注文の対応を保存し、API から受け取った checkoutUrl へ遷移させる手順が分かります。"
sidebar_label: 決済を開始する
sidebar_position: 2
---

# 決済を開始する

自社サーバーが決済 ID と注文の対応を保存した後で、API から受け取った `checkoutUrl` へページ全体を遷移させます。URL を決済 ID から自作しないでください。

```js
async function startCheckout(orderId) {
  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  if (!response.ok) throw new Error('決済を開始できませんでした');
  const { checkoutUrl } = await response.json();
  // 再試行で終端の決済が返ったとき、自社サーバーは checkoutUrl を返さない。自社の注文画面へ移す（URL は例）
  if (!checkoutUrl) return window.location.assign(`/orders/${encodeURIComponent(orderId)}`);
  window.location.assign(checkoutUrl);
}
```

`/api/checkout` は加盟店が用意するエンドポイントの例です。自社のセッション認証・CSRF 対策を適用し、注文の所有者と金額をサーバーで確認してください。通信の再送で STBLpay が終端の既存決済を返したときは、自社サーバーが応答の `status` を確かめ、ブラウザへ `checkoutUrl` を返さないようにします。STBLpay の応答には `checkoutUrl` が入っています（扱いは[冪等性](/server/create-payment#冪等性)）。

ボタンは要求中に無効化します。サーバーでも通信の再送には同じ `orderId` を使います。通信失敗だけで新しい `orderId` を作らないでください。

遷移前に注文内容を永続化し、復帰先を決済作成時に `returnUrl` として指定します。遷移したことや復帰したことだけで注文を支払い済みにしないでください。

## 購入ボタンの見た目

ボタンには、公式の「すてぶるペイで支払う」ボタンを使うことをおすすめします。CSS とロゴ、「お支払い方法」の並びに置くマークを<a href="/press/#merchant-kit">プレスキット</a>で配っています。購入者がほかの決済と見分けやすくなるので、よかったら使ってください。

次は [復帰と結果の受け取り](/client/handle-result)を参照してください。
