# stbl-pay-site

すてぶるペイ（STBL Pay）の公開サイト（LP・デモ）。[stbl-pay.com](https://stbl-pay.com) として Cloudflare Pages で配信しています。

## ローカル確認

ビルド不要の静的サイトです。

```sh
python3 -m http.server 4173 --directory .
# → http://localhost:4173/ をブラウザで開く
```

Cloudflare Pages Functions（`functions/api/early-access.js`）込みで確認する場合:

```sh
npx wrangler pages dev . --compatibility-date=2026-07-07
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

- 「すてぶるペイのつかいかた」の第1〜8回（英語ページは第8回の英語字幕版だけ）。予告は YouTube に上げていないので載せていません。番外編は手数料の数字など営業向けの内容を含むため載せていません。
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

- 読み込み時は iframe を置かない。ポスター画像（`loading="lazy"`）のリンクだけを出し、押されたら YouTube の埋め込み（iframe）を作って再生する（`assets/lp.js`）。初期表示やスクロールでは YouTube に接続せず、何も読み込みません（押したときに iframe を読み込みます）。接続を先に済ませる `preconnect`（`https://www.youtube-nocookie.com`）は、ポスターや一覧の回にポインタが乗ったとき（フォーカスが来たときも）だけ、1 回足します。スクロールで動画の欄に近づいただけでは足しません（再生する意思があるときだけ Google に接続するため）。
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
- 絵は `assets/char/`（video-studio の `assets/char/how/` と `sprites/` から切り出し）。装飾なので `alt=""`・`aria-hidden="true"`、会話は本文として読み上げます。

## デプロイ

`main` への push で GitHub Actions が Cloudflare Pages へ自動デプロイします（`workflow_dispatch` で手動実行も可能）。配信対象は workflow 内で `dist/` に組み立てた本番ファイルのみです。

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
