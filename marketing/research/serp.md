## 結論（先に）
1. **検索順位は正確に取れていない。** 環境の WebSearch は順位付きの SERP ではなく、関連ページ群の要約を返す。DuckDuckGo HTML 版は空応答、Bing の curl は「JPYC 決済」だけ妥当で、ほか 4 語はゴミ結果（YouTube、成人サイトなど）だった。以下の「上位ドメイン」は WebSearch に出た顔ぶれ（順位ではなく出現）と、Bing の「JPYC 決済」の実測のみ。順位として使わないでください。
2. **「ステーブルコイン決済」「ステーブルコイン」の広い語は、Stripe、大手金融メディア、シンクタンク、取引所の解説が占めている。** 新規サイトの正面突破は難しい。隙間は「加盟店の導入側」の具体語（JPYC 決済 導入、個人事業主、審査なし）。
3. **「決済代行 手数料 比較」「美容室 決済 手数料」は、既存事業者（Square、stera、PayPay など）と比較サイトが強い。** 手数料の相場は 2.5〜3.6% 前後（出典は各社・比較記事で、すべて販売側の情報）。「全加盟店一律の固定料率・購入者上乗せなし」を比較軸に出せる余地はあるが、料率が未定の間は数値比較に参加できない。
4. **競合は「実証・基盤・B2B」寄りで、個人事業主や小規模ネットショップ向けに平易に書いたコンテンツは今回見つからなかった。** ここが最大の隙間（推定）。

## 語ごとの分析
**ステーブルコイン決済**: 出現した顔ぶれは Stripe（docs と resources の解説）、Impress Watch、bitbank のナレッジ、Forbes Japan、Helius。形は解説記事とニュース。りそな HD の実店舗実証、B2B 決済の成長予測、発行体の信頼性への注意などが語られている。Bing では Yahoo 知恵袋が大量に出たが、品質の低い SERP のため参考程度。隙間: 「加盟店が導入するには」の実務視点（手数料、入金、会計、返金、税）。

**ステーブルコイン**: 出現は大和総研（dir.co.jp）、コトバンク、Weblio、ethereum.org/ja、マネックス用語集、babypips、dlri、issoh など。辞書・用語集・大手シンクタンクが中心で、Wikipedia 系も強い。新規が入る余地は小さい。この語は「入口の被リンク・用語集の補強」として扱い、直接の上位は狙わないのが現実的（推定）。

**JPYC 決済**: Bing 実測の上位は jpyc.jp、jpyc.co.jp、corporate.jpyc.co.jp、Coincheck の記事、Wikipedia(JPYC)、ダイヤモンド、CryptoNews、CoinPost、note。WebSearch の「JPYC 決済 加盟店」では voix.jp、ネットショップ担当者フォーラム（netshop.impress.co.jp）、CoinPost、ASCII、ペイメントナビが出た。形はニュースと解説。隙間: 加盟店規約と他決済優遇の論点、導入手順、比較（voix.jp がカード規約の懸念を報じている）。

**円建てステーブルコイン 決済 加盟店**: WebSearch ではトラベルボイス、ペイメントナビ、CoinPost、秋田魁、Impress Watch、デジタルガレージのプレスリリースが出た。Bing では「円建て」の一般語（コトバンク、Weblio、ワイズ）に流れ、ステーブルコインの語義が拾われなかった。つまりこの複合語は競合が薄い（推定）。ただし順位は未確認。

**決済代行 手数料 比較**: pay-route.co.jp、お名前.com、ecnomikata、アイミツ SaaS（saas.imitsu.jp）、Square の記事が出た。形は比較表とアンケート（利用者 400 名の調査で 3.0〜3.4% が約 4 割、との記事あり）。「総コスト（月額・振込手数料・入金サイクル込み）で比べる」が定番の論じ方。割り込むには比較表型の自前コンテンツと実測の裏付けが要る。

**クレジットカード 審査 通らない 決済**: SMBC（Olive）、it-trend、現代ゴー（gentosha-go）、オリコン、楽天カード、serai が出た。内容は個人のカード発行審査の話で、**事業者の加盟店審査ではない。** 検索意図が違うため、すてぶるペイの顧客は別の語（例: 「カード決済 加盟店審査 通らない」）で探していると推定。これは未検証で、別途検索が必要。

**個人事業主 キャッシュレス 手数料**: 創業手帳（sogyotecho.jp）、Square、ドコモ、お名前.com、日本政策金融公庫（PDF）、Libecity。比較記事の料率例は Square 2.50〜3.25%、PayPay 1.98%、stera pack 1.98〜3.24%。創業手帳が複数記事を持ち強い。

**美容室 決済 手数料**: Square（美容室向け LP とコラム 3 本）、ドコモ、issoh、PayPay ストアメディア、SMBC カード（stera pack の事例。美容室で Visa/Mastercard 2.8%）。事業者の LP と導入事例が中心。ニッチ職種語は事業者コンテンツが強く、同様の職種別 LP と事例は新規にも作れる（推定）。

**ハイリスク商材 決済代行**: paymentnavi、PayPro Global、Forbes Japan（2014 年の古い記事）、英語の高リスクマーチャント記事（dodopayments、commercegate など）。日本語の最新規制に触れた良質な記事は少なく、競合が薄そうに見える。ただし、すてぶるペイの対象には、禁止業種や資金決済法上の扱いの確認が要る。この語を取りにいく前に、受け入れ可否の方針を決める必要がある（未確認）。

**stablecoin payments Japan**: The Block と Cointelegraph（Lawson と Netstars）、Forrester ブログ、Stripe の各国版「Stablecoins in Japan」、Pulse が出た。英語は海外メディアと Stripe が占める。「日本向け決済を持ちたい海外ネットショップ」向けに、英語で日本の規制と JPYC を解説した一次情報的な記事は隙間になりうる（推定）。

## 競合・関連事業者（確認できた範囲）
- **JPYC 株式会社**: 発行体。2025 年 10 月に発行開始（The Block）。加盟店手数料は取らない方針（voix.jp）。導入店 150 店超（voix.jp、時点不明）。jpyc.co.jp は WebFetch で 403、curl では 404 の応答で、サイト構成は確認できなかった。
- **Netstars「Stablecoin Pay」（StarPay）**: 店舗向け。手数料 0.98%（Cointelegraph、PRTIMES）。USDC、USDT、JPYC に対応と報じられている（出典間で対応コインの記述が食い違うため未確定）。netstars.co.jp のトップには、ステーブルコイン解説・事例・料金は載っていなかった。
- **デジタルガレージ「DG Stablecoin Payment Service」**: JCB が先行提供先。りそなと実証（2026/2/24〜3/2、USDC と JPYC）。
- **CAICAテクノロジーズ**: 2025/11/20 から EC 向け JPYC 決済コンサル。継続課金 API は提供予定（仮称）。
- **電算システム**: コンビニ収納代行網（6.5 万店超）と JPYC の共同検討。
- **ガイアックス**: 決済代行を介さない EC・フリマ向け基盤を開発中と報道（ネットショップ担当者フォーラム）。
- **Stripe**: USDC などのステーブルコイン決済と日本向け解説（stripe.com/jp/resources）。解説コンテンツが厚く、広い語の最大の壁。
- **ローソン × KDDI × HashPort**: 店頭実証（The Block）。
- **三井住友銀行 × SBI VCトレード**: 発行・流通の共同検討（ホールセール寄り）。

全体として、競合のコンテンツは「プレスリリースとニュース」中心。用語集、比較、導入ガイド、職種別の事例を自社サイトに持つ事業者は今回確認できなかった（網羅確認はしていない）。

## AI に勧められるために載るべき情報源（推定）
AI は検索結果の上位ページを根拠にする傾向があるため、以下に載るのが近道と推定する。いずれも「掲載の影響」は未検証。
1. **ニュース・業界メディア**: ネットショップ担当者フォーラム、ペイメントナビ、CoinPost、ASCII、Impress Watch、PR TIMES。JPYC 記事の常連で、既に JPYC 決済関連の引用元になっている。プレスリリース配信が最短。
2. **比較・まとめ記事**: pay-route、アイミツ、ecnomikata、創業手帳。決済手段の一覧に「ステーブルコイン決済」枠はまだ見当たらなかったため、新規掲載を狙える（推定）。
3. **Wikipedia**: JPYC の項目は Bing 上位に出る。事業者単独では記載条件（独立した出典）が厳しい。ニュース掲載の実績が先。
4. **発行体・大手の公式ページ**: JPYC 側の導入事例・パートナー一覧に載る。
5. **note、Qiita、Zenn などの個人発信**: Bing に note が出ている。開発者向け記事も引用されやすい。

## 打ち手の示唆
- 広い語（ステーブルコイン、ステーブルコイン決済）は短期の上位を狙わず、「JPYC 決済 導入」「円建てステーブルコイン 決済 加盟店」「個人事業主 決済 審査なし」など中程度の語から取る。
- 手数料の数字が未定のうちは比較表に載せにくいため、「何を比べる軸か」（総コスト、審査、入金、上乗せなし）の解説から出す。
- ニュース媒体向けのプレスリリースを早期に出し、比較記事の運営者へ掲載依頼する。

## 参照した出典（主なもの）
Stripe: https://stripe.com/jp/resources/more/stablecoin-payments-infrastructure / https://stripe.com/jp/resources/more/stablecoin-in-japan 、Netstars Stablecoin Pay: https://prtimes.jp/main/html/rd/p/000000185.000019526.html 、Cointelegraph: https://cointelegraph.com/news/japan-lawson-netstars-stablecoin-payments 、The Block: https://theblock.co/post/407982/lawson-pilots-jpyc-stablecoin 、voix.jp: https://voix.jp/money/?p=34083 、ネットショップ担当者フォーラム JPYC タグ: https://netshop.impress.co.jp/g/jpyc 、CAICA: https://paymentnavi.com/?p=167955 、DG: https://www.garage.co.jp/documents/pr/ja/20260810_JP.pdf 。その他の語の出典は sources 欄。

## 限界
順位付きの SERP は取得できなかった。WebSearch は関連ページ群の要約で順位を返さず、DuckDuckGo HTML 版は空応答、Bing の curl は「JPYC 決済」以外でゴミ結果だった。そのため、各語の上位ドメインは「出現した顔ぶれ」であり、上位 10 件の順位ではない。ページの形（解説・比較表など）は要約とタイトルからの推定で、各ページを開いて確認してはいない。競合サイトは jpyc.co.jp（WebFetch は 403）、Netstars（トップのみ）しか中身を見ておらず、他社のコンテンツ内容（用語集・事例の有無）は未確認。AI 推薦の情報源は推定のみで、ChatGPT や Perplexity での実際の引用は確認していない。Netstars の対応コインは出典間で食い違う。JPYC 導入店数 150 店超は時点不明。「カード審査 通らない」の検索意図は個人カード向けで、加盟店審査向けの語は未調査。ハイリスク商材の受け入れ方針と法的可否は未確認。

## 出典
https://docs.stripe.com/crypto/pay-with-crypto?locale=ja-JP
https://stripe.com/jp/resources/more/stablecoin-payments-infrastructure
https://stripe.com/jp/resources/more/stablecoin-in-japan
https://www.dir.co.jp/world/entry/stable-coin
https://ethereum.org/ja/stablecoins
https://voix.jp/money/?p=34083
https://netshop.impress.co.jp/g/jpyc
https://paymentnavi.com/?p=167955
https://prtimes.jp/main/html/rd/p/000000185.000019526.html
https://cointelegraph.com/news/japan-lawson-netstars-stablecoin-payments
https://theblock.co/post/407982/lawson-pilots-jpyc-stablecoin
https://www.garage.co.jp/documents/pr/ja/20260810_JP.pdf
https://pay-route.co.jp/article/?p=7795
https://saas.imitsu.jp/cate-payment/article/l-1568
https://squareup.com/jp/ja/point-of-sale/beauty
https://www.smbc-card.com/kamei/case_study/sterapack/case_02.jsp
https://sogyotecho.jp/cashless-dounyu-kojinjigyounushi/
https://paymentnavi.com/?p=43359
https://www.netstars.co.jp/