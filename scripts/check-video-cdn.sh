#!/usr/bin/env bash
# R2 に上げたつかいかた動画 10 本が、サイトから正しく配られているかを確かめる。
#
#   ./scripts/check-video-cdn.sh <ベース URL>
#   例）./scripts/check-video-cdn.sh https://media.stbl-pay.com/how/2026-10-16/
#
# 10 本それぞれに Range: bytes=0-1 を送って、次を確かめる（どれか外れたら終了コード 1）。
#   - 応答が 206（途中だけ返せる＝シークできる）
#   - Content-Type が video/mp4
#   - ETag が強い（W/ で始まらない。弱い ETag では、続きだけを取る If-Range が使えない）
#   - Cache-Control に immutable が入っている
# 続けてもう 1 回送り、cf-cache-status を表示する。HIT でなければ警告するだけ
# （初回は MISS のことがある。失敗にはしない）。
set -u

BASE="${1:-}"
case "$BASE" in
  https://*/) ;;
  *) echo "使いかた: ./scripts/check-video-cdn.sh <ベース URL>（https:// で始まり、/ で終わる）"; exit 1 ;;
esac

FILES="how-00.mp4 how-01.mp4 how-02.mp4 how-03.mp4 how-04.mp4 how-05.mp4 how-06.mp4 how-07.mp4 how-08.mp4 how-08en.mp4"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ヘッダの値（名前は大文字小文字を区別しない。同じ名前が複数あれば最後のもの）
header() { # ファイル 名前
  tr -d '\r' < "$1" | awk -v k="$2" '
    BEGIN { k = tolower(k) }
    { i = index($0, ":"); if (i > 0 && tolower(substr($0, 1, i - 1)) == k) { v = substr($0, i + 1); sub(/^[ \t]+/, "", v); r = v } }
    END { print r }'
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# Range: bytes=0-1 を送る。応答コードを返し、ヘッダを $2 に書く
ranged() { # url ヘッダの出力先
  curl -s -o /dev/null -D "$2" -w '%{http_code}' -H 'Range: bytes=0-1' --max-time 30 "$1"
}

ng=0
warn=0
for f in $FILES; do
  url="$BASE$f"
  problems=""
  : > "$TMP/h1"
  : > "$TMP/h2"

  code="$(ranged "$url" "$TMP/h1")" || code="000"
  ctype="$(lower "$(header "$TMP/h1" content-type)")"
  etag="$(header "$TMP/h1" etag)"
  cc="$(lower "$(header "$TMP/h1" cache-control)")"

  [ "$code" = "206" ] || problems="$problems 応答が${code}（206 のはず）"
  case "$ctype" in
    video/mp4 | "video/mp4;"*) ;;
    *) problems="$problems Content-Type が「${ctype:-なし}」（video/mp4 のはず）" ;;
  esac
  case "$etag" in
    "") problems="$problems ETag が無い" ;;
    W/* | w/*) problems="$problems ETag が弱い（${etag}）" ;;
  esac
  case "$cc" in
    *immutable*) ;;
    *) problems="$problems Cache-Control に immutable が無い（${cc:-なし}）" ;;
  esac

  # もう 1 回。キャッシュに乗ったかを見る
  ranged "$url" "$TMP/h2" >/dev/null || true
  cache="$(header "$TMP/h2" cf-cache-status)"

  if [ -n "$problems" ]; then
    ng=$((ng + 1))
    printf 'NG  %-13s%s\n' "$f" "$problems"
  else
    printf 'OK  %-13s 206  video/mp4  ETag 強  immutable  cf-cache-status: %s\n' "$f" "${cache:-なし}"
  fi
  if [ "$cache" != "HIT" ]; then
    warn=$((warn + 1))
    echo "    警告: $f の 2 回目が cf-cache-status: ${cache:-なし}（HIT ではない。初回は MISS のことがあるので、少し待ってもう一度試してください）"
  fi
done

echo
if [ "$ng" -ne 0 ]; then
  echo "NG: ${ng} 本が条件を外れました。"
else
  echo "OK: 10 本とも必須の条件を満たしています。"
fi
[ "$warn" -eq 0 ] || echo "警告: ${warn} 本が HIT になっていません（失敗ではありません）。"
echo "iPhone の Safari での再生とシーク（途中へ飛ぶ）は、このスクリプトでは確かめられません。実機で手で確かめてください。"

[ "$ng" -eq 0 ]
