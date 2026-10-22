# stbl-pay-site

すてぶるペイ（STBL Pay）の公開サイト（LP・デモ）。[stbl-pay.com](https://stbl-pay.com) として Cloudflare Pages で配信しています。

## ローカル確認

LP・デモはビルド不要の静的ファイルです。加盟店向けドキュメント（`/docs/`）だけは `docs-site/`（Docusaurus）からビルドします。

```sh
./scripts/build-dist.sh                        # dist/ を組み立てる（docs のビルドを含む）
python3 -m http.server 4173 --directory dist
# → http://localhost:4173/ と http://localhost:4173/docs/ をブラウザで開く
```


## 加盟店向けドキュメント（/docs/）

- ソースは `docs-site/`。ページは `docs-site/docs/` の Markdown で、ページを足したら `docs-site/sidebars.ts` にも足す
- 書きながら確認するときは `cd docs-site && npm start`（`/docs/` 以下を dev サーバーで表示）
- 英語版は `/docs/en/`。訳は `docs-site/i18n/en/docusaurus-plugin-content-docs/current/` に、日本語と同じパスで置く。日本語のページを直したら英語も直す
  - 書きながら確認するときは `cd docs-site && npm start -- --locale en`（dev サーバーは 1 言語ずつしか出さない）
  - リンク先になる見出しは、英語では `## Idempotency {/* #idempotency */}` のように id を明示する。リンク切れ・アンカー切れはビルドで落ちる
  - 画面（加盟店コンソール・決済ページ）は日本語だけなので、画面の名前は英語の後ろに日本語を括弧で添える（例：`Store & QR code (お店と QR コード)`）。それ以外に日本語を残さない（E2E で確かめる）
  - ナビ・フッター・サイドバーのカテゴリ名は `docusaurus.config.ts`・`sidebars.ts` で、状態遷移の図の文は `StateFlowchart.tsx` の `EN` で書き分ける
- `scripts/build-dist.sh` がビルドして `dist/docs/` に入れ、`_headers` の docs 用 CSP にインラインスクリプトのハッシュを書き込む（`scripts/docs-csp.mjs`）
- 配信するのはビルド結果だけ。`docs-site/` のソースは `dist/` に入れない

`_headers`（CSP）と Cloudflare Pages Functions（`functions/api/early-access.js`）込みで確認する場合は、組み立てた `dist/` を配信します（`dist/` には `functions/` も入る）:

```sh
./scripts/build-dist.sh
npx wrangler pages dev dist --compatibility-date=2026-07-07
```

## テスト・チェック

```sh
npm install
npx playwright install chromium
npm run test:e2e   # Playwright E2E（ローカル HTTP サーバーを自動起動）
npm run check      # 受入 assertion + UI 用語チェック
```

PR では GitHub Actions（`ci.yml`）が同じチェックを実行します。

## 動画とキャラクター

### つかいかた動画（`#videos`）

- 「すてぶるペイのつかいかた」の第1〜8回と番外編 2 本（まるごと解説 `how-sp`・パスキーのはなし `how-pk`）。英語ページは第8回の英語字幕版だけ。予告は YouTube に上げていないので載せていません。
- **動画は YouTube に上げて、サイトに埋め込みます。mp4 はサイトにも git にも置きません。** 埋め込みは `https://www.youtube-nocookie.com/embed/<ID>` です。
- ポスター（`how-NN.webp`・`-640`）とサムネイル（`-thumb`）はサイトのものを使います（YouTube のサムネイルは使いません）。git に入れて、サイトから配ります。
- 動画を入れる・入れ替えるときの流れ：

  1. **YouTube に上げる。** 9 本（第1〜8回、第8回の英語字幕版）。公開か限定公開にして、**埋め込みを許可**にします（許可しないと、サイトでは再生できません）。
  2. **URL を JSON に書く。** `scripts/youtube-ids.example.json` を写して、9 件の値に YouTube の URL（または 11 文字の ID）を入れます。値は `youtu.be/<ID>`・`youtube.com/watch?v=<ID>`・`/shorts/<ID>`・`/embed/<ID>`・ID だけ、のどれでも構いません。写したファイルはコミットしません。
  3. **HTML に入れる。** 9 件そろっていて、どれも ID を取り出せるときだけ書き込みます（足りない・形が違うときは、何も書かずに止まります）。

     ```sh
     cp scripts/youtube-ids.example.json youtube-ids.json   # 値を入れる
     node scripts/set-youtube-ids.mjs youtube-ids.json
     ```

     `index.html` の一覧 8 件とポスターのリンク 1 件（今の回に合わせる）、`en/index.html` のポスターのリンク 1 件（`how-08en`）の `data-youtube` と `href`（`https://www.youtube.com/watch?v=<ID>`。JS が無いときに開く先）を書き換えます。
  4. **テストする。** `npm run test:e2e`。

  - **ID が空のうちは、押しても何も起きません**（iframe も作らず、空の `watch?v=` にも飛ばしません）。ID を入れる前の HTML（`data-youtube=""`）を main にマージすると、本番で動画が再生できなくなります。
  - 回の並びや題、長さを変えたら、`index.html` の `#videos`（一覧の題・`data-dur`・`data-desc`）と各セクションの「動画で見る」も直してください。並びと題の正本は video-studio の `how-lib/series.json` です。
- **ポスター・サムネイルを作り直すとき**：video-studio の書き出し（元の mp4）から、直接書き出します。mp4 の変換はしません。

  ```sh
  ./scripts/make-video-posters.sh <video-studio/out/how-series のパス> [how-02 ...]   # 回を絞るときは、あとに足す
  ```

  ポスター（1280・640）とサムネイル（320）を `assets/video/` に書き出し、最後に元の mp4 の長さの一覧を表示します（`index.html` の `data-dur` と合わせる）。変わったら `git add` します。
- **CSP と `referrerpolicy`**：
  - `_headers` の CSP は `frame-src https://www.youtube-nocookie.com` で、この 1 つのドメインの iframe だけを許しています。埋め込みのドメインを変えるときは、ここと `assets/lp.js` の `EMBED_ORIGIN` を直します。YouTube の外部 JS（IFrame Player API）は読まないので、`script-src` は変えていません。
  - サイトは `Referrer-Policy: no-referrer` を返します。このままだと YouTube の埋め込みがエラー 153 になるので、iframe に `referrerpolicy="strict-origin-when-cross-origin"` を付けています（ページ全体の Referrer-Policy は変えません）。
- **計測**：YouTube の IFrame Player API を読まないので、再生の開始・終了のイベントは取れません。`video_play` は「ポスターや一覧を押して再生を始めたとき」に、回ごとに 1 回だけ送ります。`video_complete` は送りません。
- **公開の順序**：PR を main にマージすると本番にデプロイされるので、確認はマージの前に済ませます。次の順に進めます。
  1. 上の手順 1〜4 を済ませる（ID が 9 件とも入った HTML で、テストが通ること）。
  2. 書き換わった `index.html` と `en/index.html` をコミットして push し、PR を作る。
  3. PR のブランチ（push 済みのもの）で、GitHub Actions の「Deploy LP demo to Cloudflare Pages」を `workflow_dispatch` で流して、プレビューを作る。

     ```sh
     gh workflow run "Deploy LP demo to Cloudflare Pages" --ref <PR のブランチ名>
     ```

     `.github/workflows/deploy-cloudflare-pages.yml` は `wrangler pages deploy` に `--branch "$GITHUB_REF_NAME"` を渡します。main 以外のブランチから流すと、プロジェクトの本番ブランチ（`main`）とは別のブランチなので、プレビューのデプロイになります。本番の `stbl-pay.com` に付いているデプロイを切り替える手順はありません（カスタムドメインの手順は、付いていなければ付けるだけです）。なお、どのブランチから流しても、Pages のシークレット（`SLACK_WEBHOOK_URL`）を GitHub の値で更新する手順は通ります。流したあと、ログの `Deploy to Cloudflare Pages` に出る URL が `stbl-pay.com` でないこと、Cloudflare のダッシュボードで環境が Preview になっていることを見ます。
  4. プレビューの URL で、日本語版・英語版の再生（9 本とも、押すと再生が始まり、エラー表示が出ないこと）と、iPhone の Safari での再生を確かめる。
  5. main にマージする（push で本番にデプロイされる）。
  6. 本番で `curl -I https://stbl-pay.com/` を打って、`Content-Security-Policy` の `frame-src` が `https://www.youtube-nocookie.com` になっていることを確かめる。あわせて本番で、日本語版・英語版とも再生できることを確かめる。
- 回は `#video-how-NN`（例：`/#video-how-02`）で直接開けます（開いただけでは再生しない）。

### 表示速度（動画を載せても LP を遅くしない）

- 読み込み時は iframe を置かない。ポスター画像（`loading="lazy"`）のリンクだけを出し、押されたら YouTube の埋め込み（iframe）を作って再生する（`assets/lp.js`）。ページの読み込み（load）が済むまでは YouTube に接続しません。済んで 2 秒たったら、押してから再生までを速くするため、今の回のプレーヤーを見えない iframe（`data-video-prefetch`）で 1 回だけ読み、読み終わって 3 秒で外します（スマホはポインタが乗らないので、押すまで何も読まないと最初の再生が遅い）。データ節約の設定や 2G のときは先読みしません。接続を先に済ませる `preconnect`（`https://www.youtube-nocookie.com`）は、先読みのときと、ポスターや一覧の回にポインタが乗ったとき（フォーカスが来たときも）に 1 回足します。
- 画面外のセクションは `content-visibility: auto` で描画を後回しにし、読み込み後（またはページ内リンクを押した瞬間）に解く（`assets/lp.css`「描画の後回し」）。
- 2026-10-16 の計測（Slow 4G・CPU 4 倍遅延のスマホ相当、6 回の中央値、brotli 圧縮あり）：

  | | FCP | LCP |
  |---|---|---|
  | main（動画なし） | 1.79s | 3.23s |
  | 動画とキャラを足しただけ | 2.15s | 3.88s |
  | 上の 2 つの対策後 | 1.50s | 3.01s |

  画像を止めても遅いままだったので、遅れの原因は通信量ではなくレイアウトの量でした。
- 測り直すときは `scripts/perf/`（`serve-br.mjs` で圧縮つき配信 → `lcp.mjs` で main と交互に測る）。手順は `lcp.mjs` の冒頭。

### すてぶるくん・すてぶるちゃん

- 設定（性格・話し方・やらないこと）の正本は、stbl-pay プロジェクトの `characters/character-bible.md` です。セリフを足すときは先に読んでください。
- 呼び方は必ず「すてぶるくん」「すてぶるちゃん」（英語ページは動画の字幕と同じ Suteburu-kun / Suteburu-chan）。
- 二人は説明係ではなく、すてぶるちゃんが張り切って説明し、すてぶるくんが一段ずつ聞き返す枠で出しています。セリフで言ってよい主張は LP 本文と video-studio の `docs/claims.md` にあるものだけです。
- 絵は `assets/char/` にあります。立ち絵と会話の顔は素材集から書き出したもの（`kun/`・`chan/`・`talk/`。下の「キャラクターの素材と動き」）、FAQ の寝ている絵（`sleep-kun.webp`・`zabuton.webp`）は video-studio の `assets/char/how/` と `sprites/` から切り出したものです。装飾なので `alt=""`・`aria-hidden="true"`、会話は本文として読み上げます。

### キャラクターの素材と動き

- 二人の絵は、素材集 `stbl-pay-characters_YYYYMMDD.zip`（正本は video-studio）から書き出します。zip を展開して、`scripts/make-character-assets.sh` にそのフォルダを渡します。

  ```sh
  ./scripts/make-character-assets.sh <展開した stbl-pay-characters のフォルダ>
  ```

  書き出す先は 3 つのフォルダで、すべて透過 WebP です（合計 66 枚・約 667 KB）。書き出した絵は git に入れます（素材集が新しくなったら、流し直して `git add` します）。

  今の絵は、素材集 `stbl-pay-characters_20261021.zip`（SHA-256 `1c046b66c3fc743260d1caf54efd04dcf788f98f67bd2d0fb06580fb385b6468`）から、`cwebp` 1.6.0（libsharpyuv 0.4.2）・`ffmpeg` 9.0.2 で書き出したものです。同じ素材集と同じ版のツールなら、何度流しても同じ結果になります（版が違うと、見た目は同じでもバイト列が変わることがあります）。

  | フォルダ | 中身 | 大きさ |
  |---|---|---|
  | `assets/char/kun/`（19 枚） | すてぶるくんの部品（足・腕・体・ほほ・目 6 種・口 7 種）。左上をそろえて重ねると組み上がる | 374×261 |
  | `assets/char/chan/`（18 枚・約 465 KB） | すてぶるちゃん（上半身）。ほほえみ・得意げ・手のひら・指さしの 4 形 × 口 3 段階（`normal-0/1/2`・`proud-0/1/2`・`palm-0/1/2`・`point-0/1/2`）、まばたき 2（`blink-half`・`blink-normal`）、横目（`side-glance`）・こちらを向く（`look-camera`）・こぶし（`fist`）・座布団（`zabuton`）。素材集 chan/upper を縮めたもので、品質 80 | 400×388 |
  | `assets/char/talk/`（29 枚） | 会話の顔のコマ。すてぶるちゃん 16 枚（表情 4 種 × 口 3 段階 ＋ まばたき 4）、すてぶるくん 13 枚（部品を重ねて顔だけ切り出したもの） | 112×112 |

  縮小と切り抜きは `cwebp`（透過を正しく扱う）、部品の重ね合わせは `ffmpeg` です。ファイル名と大きさは HTML の `width`・`height` と `assets/characters.js` が決め打ちで使うので、変えないでください（素材集の大きさが想定と違うと、スクリプトが止まります）。
- **`assets/characters.js` が動かすもの**（`lp.js` のあとに `defer` で読む。画面に入っていて、タブが表示中のあいだだけ動く）：
  - すてぶるくん：体と腕の上下、呼吸、腕の揺れ（CSS の `@keyframes`。JS は `is-live` を付けるだけ。足は床に付けたまま動かさず、腕と体をまとめた `.kun-bob` だけが 2.6 秒周期で上下します）、まばたき、ときどき横を見る目線、ヒーローでは最初に 1 回だけ手を振る。
  - すてぶるちゃん（上半身の絵。ふだんは「ほほえみ」の `normal-0`）：
    - 絵ごと 3.2 秒周期で数 px、呼吸のように上下します（CSS の `chan-bob`。絵の下端の胸の切れ目は、上下しても出てこないよう床線・ティッカーの下に沈めます。ヒーローのティッカーは半透明なので、帯の向こうにパーカーがうっすら透けます。もっと沈めると、こぶしの仕草の手が帯に隠れるためです）。2.5〜5.5 秒おきにまばたきをします（ときどき 2 回続けて。話している間・仕草の間はしません）。
    - ヒーロー：最初に「横向き（`side-glance`）→ こちらを向く（`look-camera`）→ ほほえむ」と振り向きます。待機中は 12〜20 秒おきに、得意げ（`proud-0`）かこぶし（`fist`）の仕草をします。
    - 動画欄の立ち絵：すてぶるちゃんの 1 行目は得意げ（`proud`）に、3 行目は左下のすてぶるくんを指さして（`point`）話します。
    - 相談欄の立ち絵：すてぶるちゃんの行は手のひらで示して（`palm`）話し、会話の最後にお客さま用の座布団（`zabuton`）を 3 秒見せます。
    - 手を前に差し出す絵は使いません。立ち絵の並びは動画「すてぶるペイのつかいかた」と同じで、すてぶるくんが左、すてぶるちゃんが右です。
  - 会話（`.talk`）：画面に入ると 1 回だけ、セリフの長さに合わせて話す側の口をぱくぱくさせる（まばたきは再生の前後も続ける）。同じセクションの立ち絵が見えているときは、話す側の立ち絵も同じ時間だけ動く（すてぶるくんは口パク、すてぶるちゃんは行ごとの仕草＝`.talk-line` の `data-pose` で口パク。最後の行のあとの座布団は `.talk` の `data-finale`）。
  - 画面外・タブが非表示のときはタイマーを止めます（会話の再生中にタブが隠れたら止めて、表示に戻ったら最初から再生します）。すぐには要らないコマの先読みは、ページの読み込みが終わってから行います（ヒーローの登場に使う絵だけはすぐ読みます）。
  - 幅が狭くて立ち絵を隠しているときは、立ち絵の絵を読み込みません（`loading="lazy"` に対応したブラウザ。Safari は 15.4 から。それより前の Safari は、隠れている立ち絵も読み込みますが、表示と動きは変わりません）。JS が無いときは、顔も立ち絵も HTML に書いた絵のまま止まります。
- **`prefers-reduced-motion: reduce` のとき止めるもの**：体が動くもの（上下・呼吸・腕の揺れ・手を振る・ヒーローの登場の振り向き）。まばたき・口パク・目線・ヒーローの待機の仕草・会話の仕草は絵の差し替えだけなので続けます。
- **守る決まり**（設定資料どおり）：
  - 左右反転しない（`scaleX(-1)` や負の scale を使わない）。色を変えない（`filter`・`hue-rotate` を使わない）。
  - すてぶるくんが浮くのは寝ているときだけ（FAQ の `.faq-nap` の絵。ここは動かさない）。起きているときは足を床線に付けたまま、体と腕だけが上下する。
  - セリフ（文字）は変えない・足さない。動かすのは絵だけです。
  - CSP と Trusted Types に合わせて、JS は「クラスの付け外し」と「`<img>` の `src` の差し替え」だけで動かします（`innerHTML`・`style` 属性・`el.style.*` を使わない）。
  - 主なブラウザ（Chrome・Edge・Firefox・Safari 14 以降・iOS Safari 14 以降）でそのまま動く範囲に収めます。2D の `transform`・`@keyframes`・`transition` だけを使い、`aspect-ratio`・`inset`・flex の `gap`・個別の transform プロパティ・Web Animations API・Canvas は使いません。JS は ES2017 までです。
- テストは `tests/e2e/characters-motion.spec.mjs`（素材のそろい・組み立て・並び・会話の再生と仕草・まばたき・上下・生きている間だけ動く・reduce・ヒーローの登場と待機の仕草・手を振る・狭い幅・JS なし・本番ヘッダの CSP）。

## デプロイ

`main` への push で GitHub Actions が Cloudflare Pages へ自動デプロイします（`workflow_dispatch` で手動実行も可能）。配信対象は `scripts/build-dist.sh` で `dist/` に組み立てた本番ファイルのみです。

必要な repository secrets / variables:

```txt
Secrets:
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
SLACK_WEBHOOK_URL

Variables:
CLOUDFLARE_PAGES_PROJECT_NAME
```

`CLOUDFLARE_API_TOKEN` には Cloudflare Pages の deploy と Pages secret 更新ができる権限が必要です。CD は `stbl-pay.com` を Pages custom domain として自動追加します。
