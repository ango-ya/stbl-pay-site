---
title: 決済を開始する
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
  window.location.assign(checkoutUrl);
}
```

`/api/checkout` は加盟店が用意するエンドポイントの例です。自社のセッション認証・CSRF 対策を適用し、注文の所有者と金額をサーバーで確認してください。

ボタンは要求中に無効化します。サーバーでも同じ注文の再試行には同じ `orderId` を使います。通信失敗だけで新しい注文番号を作らないでください。

遷移前に注文内容を永続化し、復帰先を決済作成時に `returnUrl` として指定します。遷移したことや復帰したことだけで注文を支払い済みにしないでください。

次は [結果の表示](/client/handle-result)を参照してください。
