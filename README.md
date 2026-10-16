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
  # 2. 版を確かめる。10 本の確認と版の計算だけをして、何も上げない
  ./scripts/upload-videos-r2.sh [YYYY-MM-DD] --dry-run
  # 3. R2 に上げる。日付は省略すると今日。2 で出た日付を付けると、版がずれない
  ./scripts/upload-videos-r2.sh [YYYY-MM-DD]
  # 4. index.html と en/index.html の mp4 の URL を、その版に向ける
  node scripts/set-video-base.mjs https://media.stbl-pay.com/how/<版>/
  # 5. 配信を確かめる。終了コードが 0 になるまで公開しない
  ./scripts/check-video-cdn.sh https://media.stbl-pay.com/how/<版>/
  # 6. 書き換わった index.html と en/index.html をコミットする
  ```

  - 変換は 1080p・30fps・H.264＋AAC、faststart。crf 26 で固定です（R2 には Pages の 25MiB の上限が無いため、サイズで作り直すことはしません）。ポスター（1280・640）とサムネイル（320）も同じ手順で作り直されるので、変わったら `git add` します。
  - **版の考え方**：版は `<日付>-<中身のハッシュ 8 桁>`（例：`2026-10-16-78b0f288`）です。ハッシュは、10 本（`how-00` … `how-08`、`how-08en` の順）について 1 行ずつ「そのファイルの sha256（16 進 64 桁）、半角スペース 2 つ、ファイル名」を並べたテキスト（各行は LF で終わる）の sha256 の先頭 8 桁（小文字）です。中身が変われば版も変わるので、同じパスには同じバイト列しか載りません。だから 1 年キャッシュさせる `immutable` でも、作り直した動画が古いまま残ることはなく、同じ版を上げ直しても害がありません。日付は引数で決めます（省略すると今日）。日付を省略したまま日をまたぐと版が変わるので、やり直すときは `--dry-run` で出た日付を付けて打ちます。
  - **`upload-videos-r2.sh` の確認と、途中で失敗したとき**：上げる前に、公開 URL へ HEAD を送ります。200 は「もう上がっている（同じ中身）」として飛ばし、404 は上げ、それ以外（通信できない・403・5xx など）は止まります。10 本とも 200 なら、何も上げずに次のコマンドを表示して終わります。この確認は上書きを防ぐためのものではなく、上がっているものを飛ばすためのものです（キャッシュされた 404 のせいで上げ直しても、同じ中身なので害はありません）。途中で失敗したら、同じコマンドをもう一度流せば、上がっていない分だけ上げます。
  - 上げるときのヘッダは `Content-Type: video/mp4`、`Cache-Control: public, max-age=31536000, immutable`。スクリプトが付けます。
  - 認証は `wrangler login` か、環境変数 `CLOUDFLARE_API_TOKEN`（スクリプトには鍵を書きません）。バケット名・オリジンは環境変数 `R2_BUCKET`・`MEDIA_ORIGIN` で変えられます。
  - バケット・独自ドメイン・キャッシュルールの作り方は、stbl-pay-terraform の `docs/runbooks/cloudflare-media-r2-setup.md` にあります。
  - **`check-video-cdn.sh` の確かめと終了コード**：10 本それぞれに `Range: bytes=0-1` を 2 回送り、1 回目・2 回目の両方で、206・`Content-Type: video/mp4`・`Content-Range: bytes 0-1/<総サイズ>`・強い ETag（`W/` でない）・`Cache-Control` に `public`、`max-age=31536000`、`immutable` がすべて入っていること、を確かめます。手元に `assets/video/<ファイル>` があれば、総サイズがファイルのサイズと一致すること、ETag が 32 桁の 16 進ならファイルの MD5 と一致することも確かめます（32 桁の 16 進でない ETag は MD5 の照合を飛ばして表示だけ。手元に無ければ飛ばしたと表示します）。2 回目の `cf-cache-status` も見ます。

    | 終了コード | 意味 |
    | --- | --- |
    | `0` | 10 本とも必須条件が OK で、2 回目がすべて `HIT`。公開してよい |
    | `1` | 必須条件が NG の本がある。直すまで公開しない |
    | `2` | 必須条件は OK だが、2 回目が `HIT` でない本がある。未完了なので、数分おいてやり直す |

  - `_headers` の CSP は `media-src 'self' https://media.stbl-pay.com` を許しています。mp4 の置き場のドメインを変えるときは、ここも直します。`<video>` に `crossorigin` は付けません（CORS は要りません）。
  - iPhone の Safari での再生とシーク（途中へ飛ぶ）は、`check-video-cdn.sh` では確かめられません。公開前に、下のプレビューで実機を使って手で確かめます。
- **公開の順序**：PR を main にマージすると本番にデプロイされるので、確認はマージの前に済ませます。次の順に進めます。
  1. R2 に上げる（`upload-videos-r2.sh`）。
  2. `set-video-base.mjs` で、`index.html` と `en/index.html` の mp4 の URL をその版に向ける。
  3. `check-video-cdn.sh` が終了コード 0 になることを確かめる（1 なら直す。2 なら数分おいてやり直す）。
  4. HTML をコミットして push し、PR を作る。
  5. PR のブランチ（push 済みのもの）で、GitHub Actions の「Deploy LP demo to Cloudflare Pages」を `workflow_dispatch` で流して、プレビューを作る。

     ```sh
     gh workflow run "Deploy LP demo to Cloudflare Pages" --ref <PR のブランチ名>
     ```

     `.github/workflows/deploy-cloudflare-pages.yml` は `wrangler pages deploy` に `--branch "$GITHUB_REF_NAME"` を渡します。main 以外のブランチから流すと、プロジェクトの本番ブランチ（`main`）とは別のブランチなので、プレビューのデプロイになります。本番の `stbl-pay.com` に付いているデプロイを切り替える手順はありません（カスタムドメインの手順は、付いていなければ付けるだけです）。なお、どのブランチから流しても、Pages のシークレット（`SLACK_WEBHOOK_URL`）を GitHub の値で更新する手順は通ります。流したあと、ログの `Deploy to Cloudflare Pages` に出る URL が `stbl-pay.com` でないこと、Cloudflare のダッシュボードで環境が Preview になっていることを見ます。
  6. プレビューの URL で、日本語版・英語版の再生と、iPhone の Safari での再生・シーク（途中へ飛ぶ）を確かめる。
  7. main にマージする（push で本番にデプロイされる）。
  8. 本番で `curl -I https://stbl-pay.com/` を打って、`Content-Security-Policy` に `media-src` があることを確かめる。あわせて本番で、日本語版・英語版とも再生できることを確かめる。
- **手元で mp4 を再生して確かめたいとき**：`node scripts/set-video-base.mjs --local` で、HTML の mp4 の URL をサイトの中（`assets/video/`）に戻します。`assets/video/` に mp4 を置いた状態で見られます。**この状態の HTML はコミットしません**。確かめ終わったら、上のコマンド例の手順 4 の `set-video-base.mjs https://media.stbl-pay.com/how/<版>/` で本番の版に向け直してください。
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
