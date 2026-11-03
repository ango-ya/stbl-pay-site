#!/usr/bin/env bash
# 本番（stbl-pay.com）を外から見て、検索エンジンと AI のクローラーにどう見えているかを点検する。
#   ./scripts/seo-live-check.sh [ベース URL]   （既定：https://stbl-pay.com）
# 応答コード・X-Robots-Tag・クローラーごとの可否は、Cloudflare の設定でも変わるので E2E では見られない。
# デプロイのあとと、Cloudflare の設定を変えたあとに流す。NG が 1 つでもあれば 1 で終わる。
set -u
BASE="${1:-https://stbl-pay.com}"
fail=0
ok() { echo "OK  $*"; }
ng() { echo "NG  $*"; fail=1; }

status() { curl -s -o /dev/null -w '%{http_code}' -A "${2:-Mozilla/5.0}" "$BASE$1"; }
expect_status() { # パス 期待するコード [User-Agent]
  local got bot
  got="$(status "$1" "${3:-}")"
  bot="$(printf '%s' "${3:-}" | grep -oE '[A-Za-z-]*[Bb]ot|ChatGPT-User' | grep -v '^bot$' | head -1)"
  [ "$got" = "$2" ] && ok "$1 → ${got}${bot:+（${bot}）}" || ng "$1 → ${got}（${2} のはず）${bot:+（${bot}）}"
}

echo "== ページとファイル"
for p in / /en/ /docs/ /docs/en/ /robots.txt /llms.txt; do expect_status "$p" 200; done
for p in /this-page-does-not-exist /docs/this-page-does-not-exist/ /docs/en/this-page-does-not-exist/; do expect_status "$p" 404; done
for p in /sitemap.xml /docs/sitemap.xml /docs/en/sitemap.xml; do
  expect_status "$p" 200
  curl -s "$BASE$p" | grep -q '<urlset' && ok "$p は XML" || ng "$p が XML でない（LP の HTML が返っている？）"
  curl -s "$BASE/robots.txt" | grep -qx "Sitemap: https://stbl-pay.com$p" && ok "robots.txt に $p" || ng "robots.txt に Sitemap: $p が無い"
done

echo "== OGP 画像と IndexNow の鍵"
for p in / /en/; do
  og="$(curl -s "$BASE$p" | grep -o '<meta property="og:image" content="[^"]*"' | sed 's/.*content="https:\/\/stbl-pay.com//; s/"$//')"
  [ -n "$og" ] && expect_status "$og" 200 || ng "$p に og:image が無い"
done
key="$(grep -o 'const KEY = "[0-9a-f]*"' "$(dirname "$0")/indexnow.mjs" | cut -d'"' -f2)"
[ "$(curl -s "$BASE/$key.txt")" = "$key" ] && ok "IndexNow の鍵ファイル" || ng "/$key.txt が鍵を返さない"

echo "== noindex（デモ画面）"
# .html は pretty URL へ転送されるので、転送先（-L で最後の応答）が 200 で noindex であることを見る
for p in /demo /demo/ /demo.html /pay /pay.html /jpyc-ex /jpyc-ex.html; do
  h="$(curl -sL -D - -o /dev/null "$BASE$p" | awk 'BEGIN{RS="\r?\n\r?\n"} NF{last=$0} END{print last}')"
  printf '%s' "$h" | head -1 | grep -q ' 200' || { ng "$p の転送先が 200 でない"; continue; }
  printf '%s' "$h" | grep -qi '^x-robots-tag: *noindex' && ok "$p は noindex" || ng "$p に X-Robots-Tag: noindex が無い"
done

echo "== canonical"
for p in / /en/; do
  curl -s "$BASE$p" | grep -q "<link rel=\"canonical\" href=\"https://stbl-pay.com$p\"" && ok "$p の canonical" || ng "$p の canonical が無いかずれている"
done

echo "== クローラー（robots.txt では全部許可している）"
for ua in \
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" \
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)" \
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)" \
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)" \
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)" \
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" \
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" \
  "CCBot/2.0 (https://commoncrawl.org/faq/)"; do
  for p in / /llms.txt; do expect_status "$p" 200 "$ua"; done
done

[ "$fail" -eq 0 ] && echo "すべて OK" || echo "NG があります"
exit "$fail"
