#!/usr/bin/env bash
# 「すてぶるペイのつかいかた」の書き出し（video-studio/out/how-series/）を、
# サイト用の mp4・ポスター・サムネイルに変換して assets/video/ に置く。
#
#   ./scripts/encode-videos.sh <how-series のフォルダ>
#
# - 1080p・30fps・H.264（High）＋AAC 96kbps、faststart。mp4 は git に入れない（.gitignore）。
# - ポスター（1280・640）とサムネイル（320）も作る。こちらは git に入れる。
# - Cloudflare Pages は 1 ファイル 25MiB まで。24MB を超えたら crf を上げて作り直す。
# - ファイル名の「予告」「第N回」「英語字幕版」から how-00 / how-0N / how-0Nen を決める。
#   番外編は LP に載せないので変換しない（手数料の数字など営業向けの内容を含むため）。
# - 回の並びや題を変えたら、index.html の #videos（一覧の題・長さ・説明）も直す。
#   長さは最後に表示する一覧を見て合わせる。
set -euo pipefail

SRC="${1:?how-series のフォルダを指定してください}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/video"
LIMIT=24000000
mkdir -p "$OUT"

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
  dst="$OUT/$id.mp4"
  echo "encode: $name -> $id.mp4"
  crf=26
  encode "$src" "$dst" "$crf"
  while [ "$(stat -c %s "$dst" 2>/dev/null || stat -f %z "$dst")" -ge "$LIMIT" ]; do
    crf=$((crf + 2))
    [ "$crf" -le 32 ] || { echo "NG: $id.mp4 が 24MB に収まりません"; exit 1; }
    echo "  24MB を超えたので crf $crf で作り直します"
    encode "$src" "$dst" "$crf"
  done
  at="$(poster_at "$id")"
  still "$dst" "$at" 1280:720 80 "$OUT/$id.webp"
  still "$dst" "$at" 640:360 74 "$OUT/$id-640.webp"
  still "$dst" "$at" 320:180 74 "$OUT/$id-thumb.webp"
done

echo
echo "長さ（index.html の data-dur と合わせる）:"
for f in "$OUT"/how-*.mp4; do
  d="$(printf '%.0f' "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")")"
  printf '  %s  %d:%02d  %s bytes\n' "$(basename "$f")" "$(( d / 60 ))" "$(( d % 60 ))" "$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f")"
done
