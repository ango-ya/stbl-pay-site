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
  bot="$(printf '%s' "${3:-}" | grep -oE '[A-Za-z-]*[Bb]ot|ChatGPT-User|Perplexity-User|Claude-User' | grep -v '^bot$' | head -1)"
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

echo "== robots.txt（リポジトリと同じものが配られているか。Cloudflare が行を差し込むと違いが出る）"
repo_robots="$(dirname "$0")/../robots.txt"
if diff <(curl -s "$BASE/robots.txt" | tr -d '\r') <(tr -d '\r' < "$repo_robots") > /dev/null; then
  ok "配られている robots.txt はリポジトリの robots.txt と同じ"
else
  ng "配られている robots.txt がリポジトリのものと違う（Cloudflare の管理された robots.txt や AI の学習を止める設定を確かめる）"
fi

echo "== OGP 画像（sitemap.xml の全ページ。200 で image/png、ほかのサイトからも読める CORP）と IndexNow の鍵"
n=0
for u in $(curl -s "$BASE/sitemap.xml" | grep -o '<loc>[^<]*</loc>' | sed 's/<[^>]*>//g'); do
  n=$((n+1))
  p="/${u#https://stbl-pay.com/}"
  og="$(curl -s "$BASE$p" | grep -o '<meta property="og:image" content="[^"]*"' | head -1 | sed 's/.*content="https:\/\/stbl-pay.com//; s/"$//')"
  if [ -z "$og" ]; then ng "$p に og:image が無い"; continue; fi
  got="$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$BASE$og")"
  [ "$got" = "200 image/png" ] && ok "$p の og:image → $og" || ng "$p の og:image $og → ${got}（200 image/png のはず）"
  curl -sI "$BASE$og" | grep -qi '^cross-origin-resource-policy: *cross-origin' && ok "$og は CORP cross-origin" || ng "$og に Cross-Origin-Resource-Policy: cross-origin が無い（_headers の例外が効いていない）"
done
[ "$n" -ge 20 ] && ok "sitemap.xml の URL ${n} 件" || ng "sitemap.xml から URL を ${n} 件しか拾えない"
curl -sI "$BASE/" | grep -qi '^cross-origin-resource-policy: *same-origin' && ok "HTML の CORP は same-origin のまま" || ng "/ の Cross-Origin-Resource-Policy が same-origin でない"
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
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)" \
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)" \
  "CCBot/2.0 (https://commoncrawl.org/faq/)"; do
  for p in / /llms.txt /learn/ /learn/chargeback/; do expect_status "$p" 200 "$ua"; done
done

[ "$fail" -eq 0 ] && echo "すべて OK" || echo "NG があります"
exit "$fail"
