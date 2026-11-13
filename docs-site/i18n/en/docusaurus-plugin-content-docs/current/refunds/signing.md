---
title: Signing refund requests
sidebar_label: Signing refund requests
---

# Signing refund requests

Draft for preview review. Download the standalone Node.js [reference implementation](pathname:///examples/refund-signer.mjs) and [fixed vectors](pathname:///examples/refund-signing-vectors.json). No packaged SDK is distributed. The vector private key is **PUBLIC TEST ONLY** and known to everyone. Never register it with a live store; generate your own key.

## HTTP signature

Send `x-stbl-api-key`, `x-stbl-signature`, `x-stbl-timestamp` and `x-stbl-nonce`. Do not use Authorization. The nonce is a fresh random 32-byte lowercase hex value with `0x`. Timestamp is milliseconds, with a ±60000ms window.

Join these five fields with newlines, without a trailing newline:

```text
METHOD
originalUrl (including the exact query string)
sha256hex(rawBody)
timestamp
nonce
```

An absent GET/DELETE body is an empty byte sequence. Hash the transmitted raw bytes, preserving JSON whitespace, newlines and non-ASCII encoding. Do not reserialize after signing. Use P-256/SHA-256 and a 128-character hex signature containing raw `r || s`, each exactly 32 bytes. Keep leading zeros; do not send DER here.

## Challenge signature

The prepare challenge is hex32 with `0x`. Encode its 32 bytes as base64url in clientDataJSON, with `type="webauthn.get"`, `origin="stbl-pay:machine"` and `crossOrigin=false`. The origin is self-declared and does not assert successful browser-origin verification.

The authenticatorData bytes are `sha256(rpId) || 0x01 || uint32BE(0)`. UP is a format requirement, not evidence of human presence. Do not set UV. The counter is not an identity factor. Sign `authenticatorData || sha256(clientDataJSON)` using P-256/SHA-256 and return a **DER signature encoded as base64url** in `assertion.signature`. This differs from the HTTP raw signature.

Node's `sign('sha256', bytes, ...)` hashes internally. Do not hash those signing bytes beforehand. Match KMS/HSM RAW/DIGEST settings accordingly. ECDSA values vary with signing randomness: verify with the public key instead of comparing signature strings.

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

