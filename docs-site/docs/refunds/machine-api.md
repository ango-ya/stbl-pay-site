---
title: 加盟店サーバーからの返金
sidebar_label: 加盟店サーバーからの返金
---

# 加盟店サーバーからの返金

このページは公開準備中の仕様です。本番提供開始の案内ではありません。JPYC EX への事前共有後に提供状況を更新します。

## 鍵の登録と承認

加盟店サーバー内で P-256 鍵を生成し、秘密鍵は加盟店のシークレット管理基盤または KMS/HSM に保持してください。暗号屋へ秘密鍵を送信しません。Node.js では `generateKeyPairSync('ec', { namedCurve: 'prime256v1' })` を使い、登録には非圧縮公開鍵 `0x04 || X || Y` を渡します。

owner が店舗の詳細（ネットショップは「組み込みの準備」タブ、店頭QRは「設定」タブ）の「加盟店サーバーからの返金」で「返金 API の鍵」を登録し、パスキーで委任状を承認します。未失効の鍵は承認待ちを含め店舗あたり10件までです。承認対象は公開鍵・返金のみ・1件の上限・wallet・epoch・chainIdです。上限未指定は上限なし、`"0"` は返金不可です。キー `stblpay_machine_` + 43文字のbase64urlは発行・再発行時に一度だけ表示されます。決済 API キーとは相互に使用できません。

## API フロー

すべて [HTTP 署名](/refunds/signing) を付けます。金額 `amountJpy` は小数6桁までの円建て文字列で、浮動小数へ変換しません。

1. `GET /payment_intents/{paymentIntentId}/refundable` で実行可能額とblockerを確認する。
2. `POST /payment_intents/{paymentIntentId}/refunds/prepare` に `{"amountJpy":"100"}` を送る。
3. 応答の `challenge` と `rpId` を署名し、`POST /payment_intents/{paymentIntentId}/refunds/submit` に `stagedOpId` と `assertion` を送る。
4. 受付応答の `refundId` を保存し、`GET /refunds/{refundId}` または `GET /payment_intents/{paymentIntentId}/refunds` で照会する。受付は完了ではなく、受付応答にはtx hashがありません。

返金先は元の支払人に固定され、prepareは宛先を返しません。ownerとすべてのmachineは加盟店ウォレットの直列枠を共有します。別店舗の操作や償還も枠を使用するため、並行実行で枠を増やせません。他店舗の記録は404です。同店舗の受理済み返金は照会でき、未消費の準備は本人のものだけを取得・取消できます。

## 通信結果が不明なとき

- prepare応答喪失：照会の `ownStaged` を確認する。同じmachineが別決済で準備した操作も含みます。再準備の前に `DELETE /staged_operations/{stagedOpId}` で本人の準備を取り消す。
- submit応答喪失：同じ `stagedOpId` と同じassertionを再送する。HTTPのnonce・timestamp・署名は新しくする。新しい返金をprepareしない。
- Webhook未着：照会で突合する。`refund.confirmed` が完了、`refund.failed` が失敗。元の決済は `settled` のままです。
- HTTP419 `auth/clock_skew`：応答の `details.serverTime`（epochミリ秒）で差分を補正し、新nonce・timestamp・HTTP署名で一度だけ再送する。補正できなければ時計を直して停止原因を調査する。

## 上限・原資・失効

`refundableNowJpy` は台帳残額・オンチェーンの裏付け・ウォレット残高による上限です。`executableJpy` はそれと `delegationCapJpy` の小さい方で、blockerがあれば `"0"` です。観測不能では推測して実行しません。原資と手数料は [返金できる額と原資](/refunds/funding)を参照してください。店舗・決済単位の制限はbackendで検査し、コントラクトが店舗・決済を識別する保証とは区別します。

ownerによる失効・上限の再承認・キー再発行は新規受理に適用します。**受理済み操作を取り消す保証はありません。** 旧委任状のオンチェーン失効は後続対応です（#677）。machineへ償還・任意宛先送金・ウォレット更新は委任しません。人のスタッフの権限ではありません。店舗無効時の新規prepare/submitは拒否されますが、照会・本人の準備の取消・ownerの失効とキー再発行は可能です。
