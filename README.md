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

- 「すてぶるペイのつかいかた」の予告と第1〜8回（英語ページは第8回の英語字幕版だけ）。番外編は手数料の数字など営業向けの内容を含むため載せていません。
- **mp4 は git に入れていません**（`.gitignore`）。1 回作り直すたびに約 125MB 増えるためです。本番では Cloudflare R2（バケット `stbl-pay-media`）から、独自ドメイン `https://media.stbl-pay.com` で配ります。サイトの HTML は `https://media.stbl-pay.com/how/<版>/how-NN.mp4` を指します（`r2.dev` は使いません）。
- ポスター（`how-NN.webp`・`-640`）とサムネイル（`-thumb`）は git に入れて、サイトから配ります。R2 には置きません。
- 動画を作り直す・入れ替えるときの流れ：

  ```sh
  # 1. 変換。回を絞るときは、あとに how-02 のように足す（省略すると全部）
  ./scripts/encode-videos.sh <video-studio/out/how-series のパス> [how-02 ...]
  # 2. R2 に上げる。版は YYYY-MM-DD（省略すると今日）。mp4 が 10 本そろっていないと止まる
  ./scripts/upload-videos-r2.sh [版]
  # 3. index.html と en/index.html の mp4 の URL を、その版に向ける
  node scripts/set-video-base.mjs https://media.stbl-pay.com/how/<版>/
  # 4. 配信を確かめる（206・video/mp4・強い ETag・immutable・キャッシュの HIT）
  ./scripts/check-video-cdn.sh https://media.stbl-pay.com/how/<版>/
  # 5. 書き換わった index.html と en/index.html をコミットする
  ```

  - 変換は 1080p・30fps・H.264＋AAC、faststart。crf 26 で固定です（R2 には Pages の 25MiB の上限が無いため、サイズで作り直すことはしません）。ポスター（1280・640）とサムネイル（320）も同じ手順で作り直されるので、変わったら `git add` します。
  - **版つきのパス**：作り直したら版を変えます。同じパスには上書きしません（1 年キャッシュさせる `immutable` のため、同じパスに置き直しても見る人の手元は変わりません）。`upload-videos-r2.sh` は、公開 URL にもう同じ版があると止まります。
  - 上げるときのヘッダは `Content-Type: video/mp4`、`Cache-Control: public, max-age=31536000, immutable`。スクリプトが付けます。
  - 認証は `wrangler login` か、環境変数 `CLOUDFLARE_API_TOKEN`（スクリプトには鍵を書きません）。バケット名・オリジンは環境変数 `R2_BUCKET`・`MEDIA_ORIGIN` で変えられます。
  - バケット・独自ドメイン・キャッシュルールの作り方は、stbl-pay-terraform の `docs/runbooks/cloudflare-media-r2-setup.md` にあります。
  - `_headers` の CSP は `media-src 'self' https://media.stbl-pay.com` を許しています。mp4 の置き場のドメインを変えるときは、ここも直します。`<video>` に `crossorigin` は付けません（CORS は要りません）。
  - iPhone の Safari での再生とシーク（途中へ飛ぶ）は、`check-video-cdn.sh` では確かめられません。上げたら実機で手で確かめてください。
- **手元で mp4 を再生して確かめたいとき**：`node scripts/set-video-base.mjs --local` で、HTML の mp4 の URL をサイトの中（`assets/video/`）に戻します。`assets/video/` に mp4 を置いた状態で見られます。**この状態の HTML はコミットしません**。確かめ終わったら、手順 3 のコマンドで本番の版に向け直してください。
- 回の並び・題・長さを変えたら、`index.html` の `#videos`（一覧の題・`data-dur`・`data-desc`）と、各セクションの「動画で見る」も直してください。並びと題の正本は video-studio の `how-lib/series.json` です。
- 回は `#video-how-NN`（例：`/#video-how-02`）で直接開けます（開いただけでは再生しない）。

### 表示速度（動画を載せても LP を遅くしない）

- 読み込み時は `<video>` を置かない。ポスター画像（`loading="lazy"`）のリンクだけを出し、押されたら `<video>` を作って再生する（`assets/lp.js`）。mp4 は押すまで 1 バイトも読まない。mp4 が別のオリジン（`media.stbl-pay.com`）にあるので、動画の欄が近づいたときだけ `preconnect` を足す（同じく `assets/lp.js`）。
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
