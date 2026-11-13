---
title: 返金 API の署名
sidebar_label: 返金 API の署名
---

# 返金 API の署名

公開準備中の仕様です。[参照実装](pathname:///examples/refund-signer.mjs)と[固定テストベクター](pathname:///examples/refund-signing-vectors.json)はNode.js用の単体ファイルです。パッケージSDKは配布しません。ベクターの秘密鍵は **PUBLIC TEST ONLY** で、誰でも知っています。本番の店舗へ登録せず、自分の秘密鍵を生成してください。

## HTTP リクエスト署名

`x-stbl-api-key`、`x-stbl-signature`、`x-stbl-timestamp`、`x-stbl-nonce` を送ります。Authorizationは使用しません。nonceは小文字 `0x` 付き32bytesの乱数で、要求ごとに更新します。timestampはミリ秒で許容窓は±60000msです。

正準文字列は次の5項目を改行で結び、末尾改行は付けません。

```text
METHOD
originalUrl（queryを含む送信時の文字列）
sha256hex(rawBody)
timestamp
nonce
```

GET/DELETEのbody無しは空バイト列です。JSONの空白・改行・非ASCIIも送信するraw bytesそのものをハッシュし、署名後に再シリアライズしません。署名はP-256/SHA-256、`r || s` の各32bytesを維持したhex128桁です。先頭ゼロを落とさず、DERを送らないでください。

## 返金 challenge の署名

prepareのchallengeは `0x` 付きhex32です。clientDataJSONではその32bytesをbase64urlへ変換し、`type="webauthn.get"`、`origin="stbl-pay:machine"`、`crossOrigin=false` とします。originは自称値で、ブラウザoriginの検証成功を意味しません。

authenticatorDataは `sha256(rpId) || 0x01 || uint32BE(0)`。UPは形式要件で人の立会いを意味せず、UVは立てません。counterは本人性の根拠ではありません。署名対象は `authenticatorData || sha256(clientDataJSON)`。このバイト列をP-256/SHA-256で署名し、**DERのbase64url**を `assertion.signature` に入れます。HTTPのraw形式とは異なります。

Nodeの `sign('sha256', bytes, ...)` は内部でSHA-256を適用します。署名対象bytesを事前にハッシュすると二重適用になり失敗します。KMS/HSMではRAW/DIGEST設定を合わせてください。ECDSA署名値は乱数で変わるため、固定署名と文字列比較せず公開鍵で検証します。

```js
import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {signRequest, signChallenge} from './refund-signer.mjs';
const privateKey = readFileSync(process.env.REFUND_PRIVATE_KEY_FILE);
const method = 'POST';
const originalUrl = '/payment_intents/pi_12345678/refunds/prepare';
const rawBody = Buffer.from(JSON.stringify({amountJpy: '100'}));
const timestamp = String(Date.now());
const nonce = '0x' + randomBytes(32).toString('hex');
const signature = signRequest({privateKey, method, originalUrl, rawBody, timestamp, nonce});
const response = await fetch(process.env.STBL_API_URL + originalUrl, {
  method, body: rawBody,
  headers: {'content-type': 'application/json', 'x-stbl-api-key': process.env.STBL_MACHINE_API_KEY,
    'x-stbl-timestamp': timestamp, 'x-stbl-nonce': nonce, 'x-stbl-signature': signature},
});
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const prepared = await response.json();
const assertion = signChallenge({privateKey, challenge: prepared.challenge, rpId: prepared.rpId});
// submit: {stagedOpId: prepared.stagedOpId, assertion}
// Sign the exact submit body with a fresh timestamp and nonce using signRequest.
```

