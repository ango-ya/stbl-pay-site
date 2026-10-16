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
- **mp4 は git に入れていません**（`.gitignore`）。1 回作り直すたびに約 125MB 増えるためです。`scripts/encode-videos.sh` で video-studio の書き出しから作ります。

  ```sh
  ./scripts/encode-videos.sh <video-studio/out/how-series のパス>
  ```

  1080p・30fps・H.264＋AAC、faststart。ポスター（1280・640）とサムネイル（320）も作ります。ポスター・サムネイルは git に入れます。
- **本番の置き場は未決**（このままでは本番に mp4 が無い）。候補は Cloudflare R2（独自ドメイン）。Git LFS は履歴は太らないが Pages の 25MiB 上限が残る。経緯と手順は引き継ぎメモを参照。
- 回の並び・題・長さを変えたら、`index.html` の `#videos`（一覧の題・`data-dur`・`data-desc`）と、各セクションの「動画で見る」も直してください。並びと題の正本は video-studio の `how-lib/series.json` です。
- 回は `#video-how-NN`（例：`/#video-how-02`）で直接開けます（開いただけでは再生しない）。

### 表示速度（動画を載せても LP を遅くしない）

- 読み込み時は `<video>` を置かない。ポスター画像（`loading="lazy"`）のリンクだけを出し、押されたら `<video>` を作って再生する（`assets/lp.js`）。mp4 は押すまで 1 バイトも読まない。
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
