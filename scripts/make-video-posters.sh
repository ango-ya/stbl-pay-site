#!/usr/bin/env bash
# 「すてぶるペイのつかいかた」の書き出し（video-studio/out/how-series/）の元の mp4 から、
# サイト用のポスター（1280・640）とサムネイル（320）を WebP で書き出して assets/video/ に置く。
#
#   ./scripts/make-video-posters.sh <how-series のフォルダ> [回 ...]
#
#   例）全部：   ./scripts/make-video-posters.sh <フォルダ>
#       2 回分： ./scripts/make-video-posters.sh <フォルダ> how-02 how-03
#
# - 2 つ目以降の引数で、書き出す回を絞れる（how-0N / how-0Nen）。省略すると全部。
# - mp4 の変換はしない。動画は YouTube に上げるので、サイトに mp4 は置かない。
#   書き出したポスターとサムネイルは git に入れる（サイトに残す。YouTube のサムネイルは使わない）。
# - ファイル名の「第N回」「英語字幕版」から how-0N / how-0Nen を決める。
#   予告と番外編は LP に載せないので書き出さない（予告は YouTube に上げていない。番外編は手数料の数字など営業向けの内容を含む）。
# - 回の並びや題を変えたら、index.html の #videos（一覧の題・長さ・説明）も直す。
#   長さは最後に表示する一覧（元の mp4 の長さ）を見て合わせる。
# - YouTube の動画 ID は、このスクリプトでは扱わない。scripts/set-youtube-ids.mjs で入れる（README「つかいかた動画」）。
# - 書き出し先は assets/video/。試すときだけ、環境変数 OUT_DIR で変えられる。
set -euo pipefail

SRC="${1:?how-series のフォルダを指定してください}"
shift
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${OUT_DIR:-$ROOT/assets/video}"
mkdir -p "$OUT"

# 書き出す回の絞り込み。空のままなら全部（bash 3.2 は空の配列を set -u で嫌うので、空白区切りの文字列で持つ）
ONLY=" "
for a in "$@"; do
  case "$a" in
    how-[0-9][0-9] | how-[0-9][0-9]en) ONLY="$ONLY$a " ;;
    *) echo "回の指定が違います: ${a}（how-02 / how-08en のように書いてください）"; exit 1 ;;
  esac
done
DONE=" "

# ポスターに使う秒（その回の中身が分かるコマ）。無い回は 1 秒目
# （macOS の bash 3.2 には連想配列が無いので case で引く）
poster_at() {
  case "$1" in
    how-08 | how-08en) echo 9 ;;
    how-03) echo 3 ;;
    how-07) echo 19 ;;
    *) echo 1 ;;
  esac
}

id_for() {
  local name="$1" n
  case "$name" in
    *番外編* | *予告*) return 1 ;;
    *第*回*英語字幕版*) n="${name#*第}"; n="${n%%回*}"; printf 'how-%02den\n' "$((10#$n))" ;;
    *第*回*) n="${name#*第}"; n="${n%%回*}"; printf 'how-%02d\n' "$((10#$n))" ;;
    *) return 1 ;;
  esac
}

# 1 コマを WebP で書き出す。ffmpeg に libwebp が無いとき（Homebrew の ffmpeg など）は cwebp で変換する
if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libwebp; then
  still() { # src 秒 幅:高さ quality out
    ffmpeg -v error -y -nostdin -ss "$2" -i "$1" -frames:v 1 -vf "scale=$3:flags=lanczos" -quality "$4" "$5"
  }
else
  command -v cwebp >/dev/null || { echo "ffmpeg に WebP のエンコーダが無く、cwebp もありません（brew install webp）"; exit 1; }
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  still() {
    ffmpeg -v error -y -nostdin -ss "$2" -i "$1" -frames:v 1 -vf "scale=$3:flags=lanczos" "$TMP/still.png"
    cwebp -quiet -q "$4" "$TMP/still.png" -o "$5"
  }
fi

shopt -s nullglob
for src in "$SRC"/*.mp4; do
  name="$(basename "$src")"
  id="$(id_for "$name")" || { echo "skip: $name"; continue; }
  if [ "$ONLY" != " " ]; then
    case "$ONLY" in *" $id "*) ;; *) continue ;; esac
  fi
  echo "poster: $name -> $id.webp, $id-640.webp, $id-thumb.webp"
  at="$(poster_at "$id")"
  still "$src" "$at" 1280:720 80 "$OUT/$id.webp"
  still "$src" "$at" 640:360 74 "$OUT/$id-640.webp"
  still "$src" "$at" 320:180 74 "$OUT/$id-thumb.webp"
  DONE="$DONE$id "
done

# 指定した回が書き出しの中に無かったら知らせる
for a in "$@"; do
  case "$DONE" in *" $a "*) ;; *) echo "NG: ${a} に当たる書き出しが ${SRC} に見つかりません"; exit 1 ;; esac
done

# 元の mp4 の長さ。回を絞っても、LP に載せる回（予告・番外編以外）の全部を表示する
echo
echo "長さ（index.html の data-dur と合わせる。元の mp4 の長さ）:"
for src in "$SRC"/*.mp4; do
  name="$(basename "$src")"
  id="$(id_for "$name")" || continue
  # ffprobe の取得と丸めは分ける（ひと続きに書くと、ffprobe が失敗しても丸めが成功して長さ 0 になる）
  raw="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")" || {
    echo "NG: ${name} の長さを ffprobe で取れませんでした"
    exit 1
  }
  case "$raw" in
    "" | . | *[!0-9.]* | *.*.*)
      echo "NG: ${name} の長さが数値ではありません（ffprobe の出力: 「${raw}」）"
      exit 1
      ;;
  esac
  d="$(LC_ALL=C printf '%.0f' "$raw")" || {
    echo "NG: ${name} の長さ「${raw}」を秒に丸められませんでした"
    exit 1
  }
  printf '  %-8s %d:%02d  %s\n' "$id" "$(( d / 60 ))" "$(( d % 60 ))" "$name"
done
