---
title: テストシナリオ
description: "組み込みがガイドどおりに動くかを確かめるテストシナリオです。Sandbox での起こし方と、再現できない項目を未検証として記録する方法が分かります。"
sidebar_label: テストシナリオ
sidebar_position: 2
---

# テストシナリオ

本ガイドの記載どおりに動くかを確認するチェックリストです。再現できない項目は、成功ではなく未検証として記録してください。

## Sandbox での起こし方

決済を任意の状態へ進めるテスト用の操作はありません。終端の状態は、次のように起こします。

- `canceled`：利用者が STBLpay のマイページで取り消します。取り消せるのは `signed` と、着金が確認される前の `issue_pending` です（[キャンセル](/lifecycle/transitions#キャンセル)）。
- 署名しないままの `expired`：応答の `checkoutExpiresAt`（操作期限）まで待ちます。Sandbox では作成から 3 時間です。
- 発行予約のあとの `expired`：着金期限に確定待ちの猶予（Sandbox では 1 時間）を足した時刻まで待ちます。`merchantExpiresAt` に指定できるのは作成から 3 日より先だけなので、数日かかります（[期限](/lifecycle/transitions)）。
- `failed` と `nonce_conflict`：任意に起こすテスト用の操作は用意していません。STBLpay をモックにしたテストで確かめてください。`failed` は Webhook の本文と状態照会の応答を、`nonce_conflict` は Webhook が届かないので状態照会の応答だけを再現します（値の形は [OpenAPI 仕様書](pathname:///openapi.yaml)にあります）。

## 決済の作成

- [ ] 文字列の `amountJpy` で決済を作成したとき、作成応答と `checkoutUrl` が返る
- [ ] 金額を JSON の数値で渡したとき、または `amountJpy` を付けずに作成したとき、400 `common/invalid_request` で拒否される
- [ ] 同じ `orderId` を連続して、または同時に再送したとき、同じ決済が返り、二重に作られない
- [ ] 期限切れになった決済と同じ `orderId` で作成し直したとき、`expired` の既存決済が返り、`checkoutUrl` へ遷移させずに `status` に応じて処理できる
- [ ] 存在しない ID や不正な入力で呼んだとき、エラーが `{ code, details? }` の形で返る

## 状態の照会

- [ ] 状態照会 API を認証ヘッダなしで呼んだとき、[状態照会の応答の項目](/reference/rest#状態照会)だけが返り、金額は含まれない

## 決済ページへの遷移

- [ ] 作成応答の `checkoutUrl` へ[トップレベル遷移](/reference/glossary)したとき、専用決済ページに進む

## 状態の進み方

- [ ] 残高で支払ったとき、`signed` から `deposit_confirmed` に進み、着金の検知は待たない
- [ ] JPYC EX で発行した JPYC の着金で支払ったとき、`issue_pending` から `deposit_confirmed` に進む
- [ ] 足りない分だけを発行したとき、今の残高と合わせて足りれば `deposit_confirmed` に進む
- [ ] 初めてウォレットを使う決済のとき、`deploying` のあと `deposit_confirmed` に戻り、その後に実行される
- [ ] 署名しないまま操作の期限が来たとき、`created` から `expired` になる
- [ ] 発行予約のあと、着金期限（発行予約の期限に 14 日を足した時刻。`merchantExpiresAt` を指定したときは、その指定値との早いほう）に確定待ちの猶予を足した時刻までに着金がそろわないとき、`issue_pending` から `expired` になる
- [ ] `canceled` が確定した決済に着金があったとき、決済は復活せず、資金は利用者のウォレットに残る
- [ ] JPYC EX での取消を STBLpay が観測できないとき、STBLpay の `canceled` とは扱わず、監視を続ける

## Webhook の受信

- [ ] 決済が終端に達したとき、`payment.settled`・`payment.failed`・`payment.canceled`・`payment.expired` のそれぞれを処理できる
- [ ] 送金の結果が確定できない状態（`nonce_conflict`）になったとき、Webhook を待たず、状態照会で検出して[問い合わせ先](/support/troubleshooting#問い合わせ先)へ調査を依頼できる
- [ ] raw body を改ざんしたとき、または時刻が許容範囲を超えたとき、Webhook を受け付けない
- [ ] 加盟店コンソールからテスト通知（`type` は `payment.settled`、本文に `test: true`）を送ったとき、注文を変えずに `2xx` を返す。スキーマ検証で未知のキーを落とした後の値ではなく、受信した本文を `JSON.parse` した直後の値で判定している
- [ ] `v1` が新旧 2 つ付いたとき、現在持っている鍵の署名がどちらの位置にあっても検証できる
- [ ] ヘッダのイベント ID だけを変えて再送したとき、ボディの `id` で二重処理を防げる
- [ ] イベントの保存の直前に停止したとき、成功応答を返さず、再送で回復する
- [ ] イベントの保存のあと、注文を更新する前に停止したとき、未処理のイベントから再開できる
- [ ] Webhook と状態照会が同時に届いたとき、注文の更新・出荷・通知が一度だけ実行される
- [ ] 未知のイベント種別が届いたとき、注文を変更せず、無視する
- [ ] 未知の `failed_reason` の値が届いたとき、Webhook を拒否せず、失敗のフォールバックとして処理する

## 復帰時の確認

- [ ] ブラウザの復帰先のクエリを改ざんしたとき、注文が支払い済みにならない



## machine 返金（公開準備中）

- [ ] 固定ベクターでquery・空body・JSON空白・非ASCII・先頭ゼロ・DER/raw・二重ハッシュ拒否を確認する
- [ ] prepare応答喪失後にownStagedを照会し、取消して復旧する
- [ ] submit応答喪失後に同じstaged/assertionを新HTTP署名で再送し、二重返金しない
- [ ] ownerとの直列枠競合、上限超過、失効、店舗無効を確認する
- [ ] refund通知の重複・未知type・未着を確認し、照会で突合する
