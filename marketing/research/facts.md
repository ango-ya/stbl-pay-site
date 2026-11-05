> この資料は 2026-11-05 の初回調査の記録で、当時の確認状況のまま残している。その後、解説ページを書く段階で一次資料を開いて確かめ直した。次の点は、ここより解説ページの記述と出典が新しい（今の執筆の基準はそちら）。
> - 施行日：2023年6月1日（金融庁「暗号資産・電子決済手段関係」、BUSINESS LAWYERS で確認）
> - 電子決済手段の定義：e-Gov の資金決済法 第2条第5項・第7項・第14項と、金融庁の研究会資料（2022年6月20日）で確認。価格の連動だけで分類は決まらない
> - JPYC の発行・償還：jpyc.co.jp の FAQ で、発行と償還は手数料無料（入金の振込手数料とガス代は利用者の負担）、3,000 円から（2026-11-05 確認）
> - JPYC の対応チェーン：Ethereum、Polygon、Avalanche、Kaia（2026-09-18 の発表と jpyc.co.jp）
> - 累計発行額：100億円超（2026-09-18 の PR TIMES）

## 結論（確認日 2026-11-05）
解説ページに書く事実の土台は、以下の「言ってよいこと」だけで十分に作れる。逆に、手数料の「相場」、審査で断られる業種の個別リスト、施行日の日付、JPYC の現時点の発行残高は、一次情報で確認できていない。数字や日付を書く場合は出典を明記するか、ぼかす。なお検索結果は二次情報が中心で、金融庁・JPYC 公式の一次ページは取得できなかった（金融庁ページは 404、jpyc.co.jp は 403）。

## 1. 日本でのステーブルコインの法的位置づけ
言ってよいこと
- 令和4年法律第61号（2022年6月成立の改正資金決済法）で、法定通貨の価値と連動し、額面での償還を約するものなどが「電子決済手段」と定義された（資金決済法 第2条第5項）。これを扱う「電子決済手段等取引業者」は登録制になった。
- 電子決済手段の発行・償還は為替取引にあたるため、発行者には銀行免許か資金移動業の登録が要る。信託型（特定信託受益権）は信託会社などが発行できる。
- 法律上、電子決済手段は暗号資産とは区別される。
- 3 メガバンクは 2026 年度中の共同発行（信託型）を目指しており、2026年7月17〜23日に実証実験を実施したと発表されている（この発表は検索結果の要約で確認。銀行 PDF 本体は未取得）。

言ってはいけない・ぼかすこと
- 「2023年6月施行」は今回の検索で日付を裏取りできなかった。書くなら「2023年に施行」程度にとどめるか、金融庁の公式資料で確認してから書く。
- 「すてぶるペイは法的に問題ない」「登録不要」といった断定は避ける。決済サービスが電子決済手段の「売買・媒介・管理」にあたるかの区分は未確認で、法的リスクが最も大きい。弁護士確認前は、事業者側の法的整理を断定しない。
- 「JPYC は暗号資産ではない」は、法律上の分類として書くのは可。「安全」「元本保証」とは書かない。

## 2. JPYC の現状
言ってよいこと
- 発行体は JPYC 株式会社（代表取締役 岡部典孝）。2025年8月18日付で資金移動業者に登録（関東財務局長 第00099号）。
- 2025年10月27日 13時に、電子決済手段「JPYC」の正式発行を開始。発行・償還のプラットフォームは「JPYC EX」。
- 日本円と 1:1 で交換可能。裏付けは預貯金と国債で、発行残高の 100% 以上とされている。
- 本人確認が必要で、マイナンバーカードの公的個人認証（JPKI）に一本化されている。発行はノンカストディ型で、発行後はユーザーのウォレットへ送られる。
- 対応チェーンは公式発表時点で Avalanche / Ethereum / Polygon。その後 Kaia が追加されたと報じられている（2026年5月時点、二次情報）。
- 旧「JPYC Prepaid」は前払式支払手段で、2025年6月1日以降は新規発行を終了。
- 資金調達はシリーズB累計約60億円（2026年8月5日のプレスリリースとして報じられている。二次情報）。

言ってはいけない・ぼかすこと
- 発行・償還の手数料は未確認。「無料」とは書かない。
- 現在の発行残高は未確認。累計発行額は 2026年4月15日時点で 21億円、別記事では 5月18日時点で 25億円と出典ごとにばらつく。数字を書くなら出典と日付を併記する。
- 「第二種」資金移動業という区分は検索結果で確認できなかった。「資金移動業者」と書く。
- JPYC EX を使う加盟店向けの規約や、決済での受け取り条件は未確認。

## 3. クレジットカード加盟店手数料
言ってよいこと
- Stripe 日本の標準料金（公式ページを WebFetch で確認）は、国内カード 3.6%、通貨換算が必要な場合は +2%。
- 銀行振込の Stripe 手数料は 1.5%（二次情報、公式ページは未確認）。
- 二次記事での相場は、カード全般で 1.98〜3.25%、Visa/Mastercard は 3.0〜3.5% 程度、EC は 3.6〜5.0% 程度と幅がある。

言ってはいけない・ぼかすこと
- 「相場は○%」の断定は避ける。「事業者・業種・規模で変わる。例として Stripe は 3.6%」と書く。
- Square の料率（3.25% や 3.6% など）は二次情報のみで未確認。

## 4. 審査で断られやすい業種
言ってよいこと
- 審査が通らない理由は業種だけではない。特定商取引法表記の漏れ、返金規約の不透明さ、申込情報と登記・サイトの不一致なども理由になる。
- カード会社が加盟店審査を必須にしているのは、トラブルの多い事業者と契約すると自社の信用が落ちるため。
- 高リスクと分類された加盟店は、準備金の積み増しや処理限度額の変更、厳しいチャージバック基準の対象になることがある。

言ってはいけない・ぼかすこと
- アダルト、情報商材、暗号資産、ギャンブル、定期購入などの個別リストは、各社の禁止業種ページで確認できていない。「断られやすい業種がある」と一般論にとどめ、個別の業種名を挙げる場合は各社の公式一覧を確認する。
- 「カードが使えない人は必ず審査に落ちる」とは書かない。

## 5. チャージバック
言ってよいこと
- 利用者がカード会社に異議を申し立てると、国際ブランドのルールに基づき取引が取り消される。返金額を負担するのは原則として加盟店。
- 売上が取り消されるほか、決済手数料や振込手数料、チャージバック手数料が戻らないのが実務上の前提。
- 3D セキュアで本人認証できていれば、カード会社側の負担になる場合がある。
- 対策は 3D セキュア、セキュリティコード、不正検知、配送先情報の活用。

言ってはいけない・ぼかすこと
- デジタルコンテンツ特有の扱いは未確認。
- 「JPYC 決済ならチャージバックが起きない」は、仕組みとして言える範囲を超えるなら避ける。ブロックチェーン上の送金は取り消せないが、返金トラブルがなくなるわけではないので、「カードのような一方的な取り消しの仕組みがない」程度にとどめる。

## 6. 銀行振込の決済手数料
- Stripe の銀行振込は 1.5%、仮想口座で入金照合、完了通知は数時間〜数日後（二次情報と Stripe ドキュメント）。
- 全銀の他行宛振込手数料は未確認。

## 7. 海外から日本の消費者に売るときの課題
- 経産省の越境 EC 調査から決済手段別の割合は得られなかった。古い記事（2009〜2016年）が中心だった。
- Stripe の通貨換算 +2% は、海外事業者が円建てで売るときのコスト要因の例として書ける（Stripe 公式で確認済み）。
- 「日本の消費者はコンビニ払いや銀行振込を好む」という趣旨の一般論は、今回の検索では出典が見つからず未確認。

## 8. 他の円ステーブルコイン・ステーブルコインの動き
- SBI VC トレードが 2025年3月4日付で USDC の取り扱い承認を得たと報じられている。国内で初のドル建てステーブルコインとされる。
- 2026年3月19日から SBI VC トレードが USDC のレンディングを開始（二次情報）。
- SBI VC トレードとアプラスが 2026年5月25〜29日に大阪で USDC の店舗決済実証を実施（二次情報）。
- SBI VC トレードが Startale と円建てステーブルコインを 2026年第2四半期に立ち上げ予定と報じられていたが、実際に発行されたかは未確認。
- メガバンク 3 行の信託型は高額の企業間送金に強みがあり、JPYC は個人・少額に強い、という棲み分けが報道で指摘されている。

## 限界
金融庁・JPYC 公式の一次ページは取得できなかった（fsa.go.jp は 404、jpyc.co.jp は 403）。そのため資金決済法の施行日（2023年6月）、JPYC の手数料・現在の発行残高・「第二種」区分、Square の料率、銀行振込の全銀手数料、決済代行各社の禁止業種の個別リスト、海外 EC の決済手段別割合は未確認。電子決済手段等取引業（売買・媒介・管理）が加盟店決済サービスにどう及ぶかも未確認で、弁護士確認が必要。メガバンク 3 行の 2026年6月・10月の発表は検索結果の要約のみで、PDF 本体は読んでいない。Stripe の 3.6%/+2% のみ公式ページで確認した。他は二次情報で、検索ツールの要約に基づくため、出典 URL を直接読んでの再確認を推奨する。

## 出典
https://stripe.com/jp/pricing
https://ascii.jp/elem/000/004/336/4336809/
https://www.businessinsider.jp/article/2508-jpyc-yen-denominated-stablecoin/
https://www.kenbiya.com/ar/ns/jiji/diversion/10174.html
https://thebridge.jp/2026/04/jpyc-raises-2-8-billion-yen-in-series-b-second-close
https://thebridge.jp/2026/03/jpyc-raises-series-b-first-close-1-78-billion-yen
https://prtimes.jp/main/html/rd/p/000000328.000054018.html
https://paymentnavi.com/?p=161376
https://www.amt-law.com/asset/pdf/bulletins2_pdf/230327.pdf
https://www.fsa.go.jp/common/diet/217/02/setsumei.pdf
https://www.mof.go.jp/tax_policy/tax_reform/outline/fy2023/request/fsa/05y_fsa_k_09.pdf
https://www.businesslawyers.jp/articles/1181
https://www.ey.com/ja_jp/insights/financial-services/outline-and-points-of-laws-and-regulations-related-to-stablecoins
https://www.mizuhobank.co.jp/release/pdf/20260610release_jp.pdf
https://www.mizuhobank.co.jp/release/pdf/20261016release_jp.pdf
https://www.tr.mufg.jp/ippan/release/pdf_mutb/261016_1.pdf
https://www.nri.com/jp/knowledge/blog/lst/2025/fis/kiuchi/1020
https://squareup.com/jp/ja/townsquare/chargeback
https://pay-route.co.jp/article/2026/03/11/understanding-chargeback-causes-and-preventing-credit-card-fraud/
https://pay-route.co.jp/article/2026/03/28/cashless-payment-fees-comparison-and-major-service-features/
https://squareup.com/jp/ja/townsquare/cashless-payment-fees
https://squareup.com/jp/ja/townsquare/creditcard-merchant-application-process
https://pay-route.co.jp/article/?p=7869
https://saas.imitsu.jp/cate-payment/article/h-1713
https://docs.stripe.com/payments/bank-transfers?locale=ja-JP
https://www.circle.com/fr/pressroom/circle-strengthens-commitment-to-japan-with-new-investment-and-expanded-usdc-access
https://www.theblock.co/post/347896/circle-to-launch-usdc-stablecoin-in-japan-through-sbi-vc-trade-other-local-exchanges-to-follow
https://cointelegraph.com/news/japan-s-sbi-vc-trade-launches-retail-usdc-lending-as-stablecoin-use-grows
https://corp.sbishinseibank.co.jp/ja/news/news/20260430a/main/01/link/260430_AP_VC_USDC.pdf