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
