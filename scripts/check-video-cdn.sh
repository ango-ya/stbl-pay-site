#!/usr/bin/env bash
# R2 に上げたつかいかた動画 10 本が、サイトから正しく配られているかを確かめる。
#
#   ./scripts/check-video-cdn.sh <ベース URL>
#   例）./scripts/check-video-cdn.sh https://media.stbl-pay.com/how/2026-10-16-1a2b3c4d/
#
# 10 本それぞれに Range: bytes=0-1 を 2 回送り、1 回目・2 回目の両方で同じ必須条件を確かめる。
#   - curl が通信できた（失敗＝000 は NG）
#   - 応答が 206（途中だけ返せる＝シークできる）
#   - Content-Type が video/mp4
#   - Content-Range が bytes 0-1/<総サイズ> の形
#   - ETag が強い（W/ で始まらない。弱い ETag では、続きだけを取る If-Range が使えない）
#   - Cache-Control に public・max-age=31536000・immutable がすべて入っている
# 手元に assets/video/<ファイル> があれば（VIDEO_DIR で場所を変えられる）、さらに次も確かめる。
#   - Content-Range の総サイズが、ファイルのサイズと一致する
#   - ETag（引用符を外したもの）が 32 桁の 16 進なら、ファイルの MD5 と一致する
#     （マルチパートの -N 付きなど、32 桁の 16 進でないときは MD5 の照合を飛ばし、表示だけする）
#   手元に無ければ、飛ばしたと表示する。
# 2 回目の cf-cache-status が HIT かも見る。
#
# 終了コード
#   0  10 本とも必須条件が OK で、2 回目がすべて HIT（公開してよい）
#   1  必須条件が NG の本がある（直すまで公開しない）
#   2  必須条件は OK だが、2 回目が HIT でない本がある（未完了。数分おいてやり直す）
set -u

BASE="${1:-}"
case "$BASE" in
  https://*/) ;;
  *) echo "使いかた: ./scripts/check-video-cdn.sh <ベース URL>（https:// で始まり、/ で終わる）"; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VIDEO_DIR="${VIDEO_DIR:-$ROOT/assets/video}"

FILES="how-00.mp4 how-01.mp4 how-02.mp4 how-03.mp4 how-04.mp4 how-05.mp4 how-06.mp4 how-07.mp4 how-08.mp4 how-08en.mp4"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ヘッダの値（名前は大文字小文字を区別しない。同じ名前が複数あれば最後のもの）
header() { # ファイル 名前
  tr -d '\r' < "$1" | awk -v k="$2" '
    BEGIN { k = tolower(k) }
    { i = index($0, ":"); if (i > 0 && tolower(substr($0, 1, i - 1)) == k) { v = substr($0, i + 1); sub(/^[ \t]+/, "", v); sub(/[ \t]+$/, "", v); r = v } }
    END { print r }'
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# Cache-Control（小文字）に、カンマで区切られたディレクティブ $2 がちょうど入っているか
has_directive() {
  printf '%s' "$1" | tr ',' '\n' | awk -v d="$2" '
    { gsub(/^[ \t]+|[ \t]+$/, ""); if ($0 == d) f = 1 }
    END { exit f ? 0 : 1 }'
}

# MD5（macOS は md5 -q、Linux は md5sum）。どちらも無ければ何も出さず失敗する
if command -v md5 >/dev/null 2>&1; then
  md5_of() { md5 -q "$1"; }
elif command -v md5sum >/dev/null 2>&1; then
  md5_of() { md5sum "$1" | awk '{ print $1 }'; }
else
  md5_of() { return 1; }
fi

# Range: bytes=0-1 を送る。応答コードを標準出力に、ヘッダを $2 に書く。curl の終了コードをそのまま返す
# （--max-filesize は、Range を無視して 200 で全部返す相手から、動画を丸ごと取らないため。超えると 63）
ranged() { # url ヘッダの出力先
  curl -s -o /dev/null -D "$2" -w '%{http_code}' -H 'Range: bytes=0-1' --max-time 30 --max-filesize 4096 "$1"
}

# 1 回分の応答を調べる。外れたところを PROBLEMS に足し（文の終わりは「。」）、分かった値を R_* に置く
#   judge <応答コード> <curl の終了コード> <ヘッダのファイル> <手元のサイズ> <手元の MD5>
judge() {
  local code="$1" rc="$2" hf="$3" lsize="$4" lmd5="$5"
  local ctype etag cc cr total unq d
  R_NOTE=""
  R_TOTAL=""
  R_CACHE=""

  # 000 は通信できなかった。63 は上の --max-filesize で止めただけ（応答は受け取れている）
  if [ "$code" = "000" ] || [ -z "$code" ]; then
    PROBLEMS="$PROBLEMS curl が通信できませんでした（終了コード ${rc}）。"
    return
  fi
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 63 ]; then
    PROBLEMS="$PROBLEMS curl が途中で失敗しました（終了コード ${rc}）。"
  fi

  ctype="$(lower "$(header "$hf" content-type)")"
  etag="$(header "$hf" etag)"
  cc="$(lower "$(header "$hf" cache-control)")"
  cr="$(lower "$(header "$hf" content-range)")"
  R_CACHE="$(header "$hf" cf-cache-status)"

  [ "$code" = "206" ] || PROBLEMS="$PROBLEMS 応答が${code}（206 のはず）。"

  case "$ctype" in
    video/mp4 | "video/mp4;"*) ;;
    *) PROBLEMS="$PROBLEMS Content-Type が「${ctype:-なし}」（video/mp4 のはず）。" ;;
  esac

  total=""
  case "$cr" in
    "bytes 0-1/"*) total="${cr#bytes 0-1/}" ;;
  esac
  case "$total" in
    "" | *[!0-9]*)
      PROBLEMS="$PROBLEMS Content-Range が「${cr:-なし}」（bytes 0-1/<総サイズ> の形のはず）。"
      total=""
      ;;
  esac
  R_TOTAL="$total"

  case "$etag" in
    "") PROBLEMS="$PROBLEMS ETag が無い。" ;;
    W/* | w/*) PROBLEMS="$PROBLEMS ETag が弱い（${etag}）。" ;;
  esac

  for d in public max-age=31536000 immutable; do
    has_directive "$cc" "$d" || PROBLEMS="$PROBLEMS Cache-Control に ${d} が無い（${cc:-なし}）。"
  done

  # 手元のファイルとの照合
  if [ -n "$lsize" ]; then
    if [ -n "$total" ] && [ "$total" != "$lsize" ]; then
      PROBLEMS="$PROBLEMS 総サイズ ${total} が手元のファイルのサイズ ${lsize} と違う。"
    fi
    unq="${etag%\"}"
    unq="${unq#\"}"
    case "$unq" in
      "" | W/* | w/*) ;;
      *[!0-9A-Fa-f]*)
        R_NOTE="ETag が MD5 ではない形（${etag}）なので MD5 の照合は飛ばし" ;;
      *)
        if [ "${#unq}" -ne 32 ]; then
          R_NOTE="ETag が 32 桁の 16 進ではない（${etag}）ので MD5 の照合は飛ばし"
        elif [ -z "$lmd5" ]; then
          R_NOTE="手元の MD5 を求められないので MD5 の照合は飛ばし"
        elif [ "$(lower "$unq")" != "$lmd5" ]; then
          PROBLEMS="$PROBLEMS ETag の MD5 ${unq} が手元のファイルの MD5 ${lmd5} と違う。"
        fi
        ;;
    esac
  fi
}

ng=0
pending=0
for f in $FILES; do
  url="$BASE$f"

  # 手元のファイル（あれば、サイズと MD5 を求める）
  lsize=""
  lmd5=""
  if [ -f "$VIDEO_DIR/$f" ]; then
    lsize="$(wc -c < "$VIDEO_DIR/$f" | tr -d ' ')"
    lmd5="$(lower "$(md5_of "$VIDEO_DIR/$f" 2>/dev/null || true)")"
  fi

  : > "$TMP/h1"
  code1="$(ranged "$url" "$TMP/h1")"; rc1=$?
  PROBLEMS=""
  judge "$code1" "$rc1" "$TMP/h1" "$lsize" "$lmd5"
  problems1="$PROBLEMS"
  note1="$R_NOTE"
  total1="$R_TOTAL"

  : > "$TMP/h2"
  code2="$(ranged "$url" "$TMP/h2")"; rc2=$?
  PROBLEMS=""
  judge "$code2" "$rc2" "$TMP/h2" "$lsize" "$lmd5"
  problems2="$PROBLEMS"
  cache="$R_CACHE"

  # 1 回目と 2 回目で外れたところが同じなら、まとめて 1 回だけ書く
  if [ "$problems1" = "$problems2" ]; then
    PROBLEMS="$problems1"
    [ -z "$PROBLEMS" ] || PROBLEMS=" 1・2回目とも:${PROBLEMS}"
  else
    PROBLEMS=""
    [ -z "$problems1" ] || PROBLEMS=" 1回目:${problems1}"
    [ -z "$problems2" ] || PROBLEMS="${PROBLEMS} 2回目:${problems2}"
  fi

  if [ -n "$lsize" ]; then
    # bash 3.2 は $変数 の直後に全角文字が続くと変数名を読み間違えるので、${} で囲む
    if [ -n "$note1" ]; then
      local_note="手元と照合（サイズ一致。${note1}）"
    else
      local_note="手元と照合（サイズ・MD5 一致）"
    fi
  else
    local_note="手元に ${VIDEO_DIR}/${f} が無いので、サイズ・MD5 の照合は飛ばした"
  fi

  if [ -n "$PROBLEMS" ]; then
    ng=$((ng + 1))
    printf 'NG    %-13s%s\n' "$f" "$PROBLEMS"
  elif [ "$cache" = "HIT" ]; then
    printf 'OK    %-13s 206  video/mp4  %s バイト  ETag 強  immutable  %s  2回目 cf-cache-status: HIT\n' "$f" "${total1:-?}" "$local_note"
  else
    pending=$((pending + 1))
    printf 'WAIT  %-13s 必須の条件は OK（%s）。2回目 cf-cache-status: %s（HIT ではない）\n' "$f" "$local_note" "${cache:-なし}"
  fi
done

echo
if [ "$ng" -ne 0 ]; then
  echo "結果: 終了コード 1。${ng} 本が必須の条件を外れました。直してからやり直してください。"
  rc=1
elif [ "$pending" -ne 0 ]; then
  echo "結果: 終了コード 2。必須の条件は 10 本とも OK ですが、${pending} 本の 2 回目が HIT ではありません。数分おいてやり直してください。"
  rc=2
else
  echo "結果: 終了コード 0。10 本とも必須の条件を満たし、2 回目がすべて HIT です。"
  rc=0
fi
echo "終了コードの意味:"
echo "  0  10 本とも必須条件が OK で、2 回目がすべて HIT（公開してよい）"
echo "  1  必須条件が NG の本がある（直すまで公開しない）"
echo "  2  必須条件は OK だが、2 回目が HIT でない本がある（未完了。数分おいてやり直す）"
echo "iPhone の Safari での再生とシーク（途中へ飛ぶ）は、このスクリプトでは確かめられません。実機で手で確かめてください。"

exit "$rc"
