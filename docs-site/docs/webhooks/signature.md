---
title: 署名検証
sidebar_label: 署名検証
sidebar_position: 2
---

# 署名検証

Webhook を注文確定の根拠にする場合、署名・タイムスタンプの検証とイベント ID による冪等処理が必須です。

## 検証する値

署名対象は `"<t>.<raw body>"` のバイト列、方式は HMAC-SHA256 です。`t` は配信試行ごとの Unix 秒で、再送時には更新されます。許容ずれの初期値は300秒です。

署名鍵は `whsec_` で始まる文字列です。`whsec_` を含めた文字列全体を、16 進数や Base64 として復号せず、そのまま HMAC の鍵に使います。`whsec_` を取り除かないでください。

`v1` は署名鍵を作り直してから 24 時間のあいだ、複数届きます。すべて保持し、自社の鍵で計算した値がいずれかと一致すれば受理します。同名キーを上書きする辞書へ変換しないでください。

## Node.js の検証例

入力の `rawBody` は JSON パーサーを通す前の Buffer です。

```js
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyStblPaySignature(rawBody, header, secret, now = Date.now()) {
  if (!Buffer.isBuffer(rawBody) || typeof header !== 'string' || !secret) return false;
  const parts = header.split(',').map((part) => part.trim());
  const timestamps = parts.filter((part) => part.startsWith('t='));
  if (timestamps.length !== 1) return false;
  const timestamp = timestamps[0].slice(2);
  if (!/^\d+$/.test(timestamp)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Math.floor(now / 1000) - seconds) > 300) {
    return false;
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest();
  return parts.filter((part) => part.startsWith('v1=')).some((part) => {
    const signature = part.slice(3);
    if (!/^[0-9a-fA-F]{64}$/.test(signature)) return false;
    return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
  });
}
```

STBLpay は Webhook を `Content-Type: application/json; charset=utf-8` で送ります。Express では Webhook ルートに `express.raw({ type: 'application/json' })` を使い、汎用の `express.json()` より先に登録します。`express.raw()` は既定では `application/octet-stream` しか受け取らないので、`type` を指定しないと本文が読み込まれず、`req.body` が Buffer にならないため、署名の検証に失敗します。検証後に `JSON.parse` と Webhook の形の検証を行ってください。

JSON をパースして再シリアライズすると、空白やキー順が変わります。検証には受信バイト列をそのまま使います。署名の比較はタイミング安全に行い、長さが違う値で `timingSafeEqual` を呼ばないでください。

## 署名鍵の発行と作り直し

Webhook の設定は、加盟店コンソールのメニューの「お店と QR コード」から対象のネットショップを開き、「組み込みの準備」タブの「お支払い完了のお知らせ先」で行います。送信先の URL と署名鍵は加盟店で 1 つで、どのネットショップから開いても同じ設定が出ます。URL の変更、「webhook を解除」、署名鍵の作り直しは、すべてのネットショップの通知に効きます。通知にはネットショップの区別がないので、`payment_intent_id` で自社の注文に対応付けてください。

- **署名鍵は、初めて送信先の URL を設定したときに発行され、そのときだけ表示されます。** 画面を閉じたあとは再表示できません。受信側のサーバーのシークレット管理基盤に保存してください。控え損ねたときは、署名鍵を作り直します。
- **URL を変更しても、署名鍵は変わりません。** 「URL を変更」では鍵を発行しません。
- **「署名鍵を作り直す」を押すと、新しい鍵と今の鍵の 2 つが 24 時間だけ有効になります。** 今の鍵は旧署名鍵として残り、失効時刻が画面に出ます。この間、署名ヘッダには `v1` が 2 個並びます。受信側は両方を集め、手元にある鍵で計算した値がどれか 1 つと一致すれば受理します。24 時間のうちに、受信側を新しい鍵へ切り替えてください。
- **旧署名鍵の期限中は、もう一度作り直せません**（409 `merchant/webhook_rotation_pending`。`details.previousSecretExpiresAt` に期限が入ります）。期限が過ぎれば作り直せます。期限を過ぎた旧鍵では署名されません。

## 鍵の漏洩が疑われるとき

署名鍵の作り直しでは旧署名鍵が 24 時間残るため、漏洩への対処には使えません。**「webhook を解除」してから設定し直してください。**

- 解除すると、新旧の署名鍵が消えます（旧署名鍵もすぐに無効になります）。
- 未配信・再送待ちの通知は打ち切られます。**設定し直しても、打ち切られた通知は再開しません。** 設定し直すと、新しい署名鍵が発行されます。
- すでに送信中の通知は、取り消せないことがあります。
- 通知が打ち切られた決済の結果は、[状態照会](/server/retrieve-payment)（`GET /payment_status/:paymentIntentId`）で突き合わせてください。決済そのものは取り消されません。
- 受信側でも、古い署名鍵を削除してください。

Webhook を設定していない間に起きた決済の通知は、あとから設定しても送られません。同じく、状態照会で突き合わせてください。

署名鍵をブラウザやログに出さないでください。[イベントの永続化と重複排除](/webhooks/idempotency)も必要です。
