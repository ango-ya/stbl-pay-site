---
title: 決済フローを理解する
sidebar_label: 決済フロー
sidebar_position: 1
---

# 決済フローを理解する

加盟店サーバーが決済を作成し、利用者は専用決済ページでパスキー署名を行います。加盟店は署名処理を実装しません。

```mermaid
sequenceDiagram
    participant User as 利用者ブラウザ
    participant Shop as 加盟店サーバー
    participant Pay as STBLpay
    participant Page as STBLpay の決済ページ
    User->>Shop: 注文の決済開始
    Shop->>Shop: 認可・金額計算・注文保存
    Shop->>Pay: POST /payment_intents（API キー）
    Pay-->>Shop: paymentIntentId と checkoutUrl
    Shop->>Shop: 注文と決済 ID の対応を保存
    Shop-->>User: checkoutUrl
    User->>Page: 専用決済ページへトップレベル遷移
    Note over User,Page: パスキー署名・必要に応じ発行体で振込手続き
    Pay->>Pay: 着金確認・ウォレット準備・決済実行
    par 流れ 1：注文を確定する（Webhook または状態照会）
        Pay-->>Shop: Webhook（終端結果。設定した場合）
        Shop->>Shop: 署名検証・冪等な注文更新
        opt Webhook を設定していない、または届かない
            Shop->>Pay: 状態照会（GET /payment_status）
            Pay-->>Shop: settled などの状態
        end
    and 流れ 2：利用者の復帰（表示用）
        Page-->>User: 「ショップに戻る」などのリンクを表示
        User->>Shop: リンクを押して returnUrl へ復帰
        opt 注文がまだ更新されていない
            Shop->>Pay: 状態照会
            Pay-->>Shop: 現在の状態
        end
        Shop-->>User: 結果を表示（分からなければ「確認中」）
    end
```

## 支払いの経路

残高が足りる場合は、`signed`（利用者の署名が済んだ）から `deposit_confirmed`（着金または残高を確認した）へ進みます。振込を伴う場合は発行体での手続き後、着金の検知と、着金が取り消されない状態になるまでの確認を経て進みます。`issue_pending` は、決済ページから予約開始の通知を STBLpay が受けたことを表します。JPYC EX での手続きが済んだかは確かめていないので、利用者が途中でやめてもこの状態になります。

必要なウォレットを作成し、決済の実行が成功した `settled` で加盟店への支払いが成立します。[状態と遷移条件](/lifecycle/transitions)を確認してください。

## 結果の受け取り

結果は 2 つの流れで加盟店に届きます。注文を確定するのは流れ 1 です。流れ 2 は、利用者の画面を元のストアに戻すためのものです。

流れ 1 では、Webhook の `payment.settled`、または加盟店のサーバーから[状態照会](/reference/rest#状態照会)して得た `settled` を根拠に注文を確定します。Webhook の設定は任意です。設定しない場合は、状態照会で `settled` を確かめてから確定してください。

Webhook は成功・失敗・取消・失効を通知します。送金の結果が確定できなかった場合（`nonce_conflict`）は Webhook が届かないため、未確定注文を[状態照会](/reference/rest#状態照会)で確かめる必要があります。ブラウザの復帰だけで商品を提供しないでください。

## 利用者がストアに戻る流れ

- 戻るリンクは、STBLpay の決済ページが表示します。リンクそのものを加盟店が作る必要はありません。戻り先（`returnUrl`）のページで注文の状態を確かめて表示する処理は、加盟店が実装します（下記）。リンクは決済が終端に着いたときだけ出て、成立したときは「ショップに戻る」、それ以外の終端（`failed`・`expired`・`canceled`・`nonce_conflict`）では「お支払い先に戻る」です。途中の状態では出ません。
- リンクの先は、決済の作成時に指定した `returnUrl` に、決済 ID を `stbl_pay_intent` クエリとして付けた URL です。`returnUrl` を指定しなかった場合は、リンクは出ません。
- 戻り先で注文がまだ更新されていなければ、状態照会で確かめます。Webhook より先に利用者が戻ることがあるためです。照会しても結果が分からない場合は、完了と表示せず「確認中」と表示してください。
- 加盟店の利用停止で決済が止まった場合は、リンクは表示されません。決済ページには「この画面を閉じて、お店のページからご注文をやり直してください。」と出ます。
