#!/usr/bin/env bash
# 「すてぶるペイのつかいかた」の書き出し（video-studio/out/how-series/）を、
# サイト用の mp4・ポスター・サムネイルに変換して assets/video/ に置く。
#
#   ./scripts/encode-videos.sh <how-series のフォルダ> [回 ...]
#
#   例）全部：   ./scripts/encode-videos.sh <フォルダ>
#       2 回分： ./scripts/encode-videos.sh <フォルダ> how-02 how-03
#
# - 2 つ目以降の引数で、変換する回を絞れる（how-00 / how-0N / how-0Nen）。省略すると全部。
# - 1080p・30fps・H.264（High）＋AAC 96kbps、faststart。crf 26 で固定。
# - mp4 は Cloudflare R2 から配る。git には入れない（.gitignore）。
#   作ったあとは、次の順に進める（詳しくは README「つかいかた動画」）。
#     ./scripts/upload-videos-r2.sh [日付] [--dry-run]   … R2 に上げる（版は <日付>-<中身のハッシュ>。--dry-run は版の確認だけ）
#     node scripts/set-video-base.mjs <ベース URL>        … index.html と en/index.html の mp4 の URL を直す
# - ポスター（1280・640）とサムネイル（320）も作る。こちらは git に入れる（サイトに残す）。
# - ファイル名の「予告」「第N回」「英語字幕版」から how-00 / how-0N / how-0Nen を決める。
#   番外編は LP に載せないので変換しない（手数料の数字など営業向けの内容を含むため）。
# - 回の並びや題を変えたら、index.html の #videos（一覧の題・長さ・説明）も直す。
#   長さは最後に表示する一覧を見て合わせる。
set -euo pipefail

SRC="${1:?how-series のフォルダを指定してください}"
shift
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/video"
mkdir -p "$OUT"

# 変換する回の絞り込み。空のままなら全部（bash 3.2 は空の配列を set -u で嫌うので、空白区切りの文字列で持つ）
ONLY=" "
for a in "$@"; do
  case "$a" in
    how-[0-9][0-9] | how-[0-9][0-9]en) ONLY="$ONLY$a " ;;
    *) echo "回の指定が違います: ${a}（how-00 / how-02 / how-08en のように書いてください）"; exit 1 ;;
  esac
done
DONE=" "

# ポスターに使う秒（その回の中身が分かるコマ）。無い回は 1 秒目
# （macOS の bash 3.2 には連想配列が無いので case で引く）
poster_at() {
  case "$1" in
    how-00 | how-08 | how-08en) echo 9 ;;
    how-03) echo 3 ;;
    how-07) echo 19 ;;
    *) echo 1 ;;
  esac
}

id_for() {
  local name="$1" n
  case "$name" in
    *番外編*) return 1 ;;
    *予告*) echo "how-00" ;;
    *第*回*英語字幕版*) n="${name#*第}"; n="${n%%回*}"; printf 'how-%02den\n' "$((10#$n))" ;;
    *第*回*) n="${name#*第}"; n="${n%%回*}"; printf 'how-%02d\n' "$((10#$n))" ;;
    *) return 1 ;;
  esac
}

encode() { # src out crf
  ffmpeg -v error -y -nostdin -i "$1" -vf "fps=30" \
    -c:v libx264 -preset slow -tune animation -crf "$3" -maxrate 1600k -bufsize 3200k \
    -profile:v high -level 4.1 -pix_fmt yuv420p \
    -c:a aac -b:a 96k -ac 2 -ar 48000 -movflags +faststart -map_metadata -1 "$2"
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
  dst="$OUT/$id.mp4"
  echo "encode: $name -> $id.mp4"
  encode "$src" "$dst" 26
  DONE="$DONE$id "
  at="$(poster_at "$id")"
  still "$dst" "$at" 1280:720 80 "$OUT/$id.webp"
  still "$dst" "$at" 640:360 74 "$OUT/$id-640.webp"
  still "$dst" "$at" 320:180 74 "$OUT/$id-thumb.webp"
done

# 指定した回が書き出しの中に無かったら知らせる
for a in "$@"; do
  case "$DONE" in *" $a "*) ;; *) echo "NG: ${a} に当たる書き出しが ${SRC} に見つかりません"; exit 1 ;; esac
done

echo
echo "長さ（index.html の data-dur と合わせる）:"
for f in "$OUT"/how-*.mp4; do
  # ffprobe の取得と丸めは分ける（ひと続きに書くと、ffprobe が失敗しても丸めが成功して長さ 0 になる）
  raw="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")" || {
    echo "NG: $(basename "$f") の長さを ffprobe で取れませんでした"
    exit 1
  }
  case "$raw" in
    "" | . | *[!0-9.]* | *.*.*)
      echo "NG: $(basename "$f") の長さが数値ではありません（ffprobe の出力: 「${raw}」）"
      exit 1
      ;;
  esac
  d="$(LC_ALL=C printf '%.0f' "$raw")" || {
    echo "NG: $(basename "$f") の長さ「${raw}」を秒に丸められませんでした"
    exit 1
  }
  printf '  %s  %d:%02d  %s bytes\n' "$(basename "$f")" "$(( d / 60 ))" "$(( d % 60 ))" "$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f")"
done
