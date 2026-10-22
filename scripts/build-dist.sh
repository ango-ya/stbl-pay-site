#!/usr/bin/env bash
# 配信物 dist/ を組み立てる。デプロイ・CI の E2E・ローカル確認で同じものを使う。
#
# 1. 配信対象のファイルを dist/ に集める（開発用ファイルは入れない）
# 2. docs-site（Docusaurus）をビルドして dist/docs/ に入れる
# 3. docs のインラインスクリプトのハッシュを dist/_headers の CSP に書き込む
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

rm -rf dist
mkdir dist
rsync -a \
  --exclude '.git' \
  --exclude '.github' \
  --exclude '.claude' \
  --exclude 'node_modules' \
  --exclude 'tests' \
  --exclude 'scripts' \
  --exclude 'dist' \
  --exclude 'docs-site' \
  --exclude 'test-results' \
  --exclude 'playwright-report' \
  --exclude 'playwright.config.mjs' \
  --exclude 'package.json' \
  --exclude 'package-lock.json' \
  --exclude 'README.md' \
  --exclude '.gitignore' \
  ./ dist/

# docs-site の依存は、入っていなければ入れる（CI では毎回入る）
if [ ! -d docs-site/node_modules ]; then
  (cd docs-site && npm ci)
fi
(cd docs-site && npm run build)
cp -R docs-site/build dist/docs

node scripts/docs-csp.mjs dist

echo "dist contents:"
find dist -maxdepth 2 | sort
