#!/usr/bin/env bash
# 素材集（stbl-pay-characters_YYYYMMDD.zip を展開したフォルダ）から、LP で動かすキャラクターの絵を
# 透過 WebP で書き出して assets/char/ の kun/・chan/・talk/ に置く。
#
#   ./scripts/make-character-assets.sh <展開した stbl-pay-characters のフォルダ>
#
# - assets/char/kun/（19 枚、374×261）：すてぶるくんの部品。素材集 kun/rig の 748×522 を半分に縮める。
#   全部同じ大きさで、左上をそろえて重ねると組み上がる（assets/characters.js が目と口の img を差し替える）。
# - assets/char/chan/（3 枚、340×480）：すてぶるちゃん（太ももまで）。素材集 chan/thigh の 566×800 を縮める。
# - assets/char/talk/（29 枚、112×112）：会話の顔のコマ。
#   すてぶるちゃんは素材集 chan/upper（660×640）から顔の範囲を切り出す。
#   すてぶるくんは rig の部品を奥から重ねて（足・腕・体・ほほ・目・口）、顔の範囲を切り出す。
# - 縮小と切り抜きは cwebp の -crop・-resize（透過を正しく扱う）。ffmpeg は重ね合わせと余白だけに使う。
#   重ねる部品は dwebp で PNG に戻してから ffmpeg に渡す（ffmpeg 自前の WebP デコーダは色が少しずれるため）。
# - 同じ素材集と同じ版のツールなら、何度流しても同じ結果になる（README に使った版を書いてある）。書き出した絵は git に入れる（サイトから配る）。
#   素材集が新しくなったら、流し直して git add する（README「キャラクターの素材と動き」）。
# - assets/char/ 直下の sleep-kun.webp・zabuton.webp（FAQ の寝ている絵）は、このスクリプトの対象外（作らない・消さない）。
# - 書き出し先は assets/char/。試すときだけ、環境変数 OUT_DIR で変えられる。
# - 必要なツール：dwebp・cwebp（brew install webp）、ffmpeg・ffprobe。
set -euo pipefail

KIT="${1:?素材集のフォルダ（stbl-pay-characters）を指定してください}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${OUT_DIR:-$ROOT/assets/char}"

for tool in dwebp cwebp ffmpeg ffprobe; do
  command -v "$tool" >/dev/null || { echo "${tool} がありません（brew install webp ffmpeg）"; exit 1; }
done
RIG="$KIT/kun/rig"
THIGH="$KIT/chan/thigh"
UPPER="$KIT/chan/upper"
for d in "$RIG" "$THIGH" "$UPPER"; do
  [ -d "$d" ] || { echo "NG: ${d} がありません。素材集の展開したフォルダ（kun/・chan/ が入っているもの）を指定してください"; exit 1; }
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/out/kun" "$TMP/out/chan" "$TMP/out/talk" "$TMP/png"

# 画像の大きさ（幅x高さ）
size_of() {
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$1"
}

# 1 枚を書き出す。入力の大きさと出力の大きさが想定どおりかを確かめる（素材集の仕様が変わったときに黙って崩れないように）
#   enc 入力 入力の大きさ 出力 出力の大きさ [cwebp の -crop・-resize ...]
# 品質は QUALITY（ふだん 90。すてぶるちゃんの立ち絵だけ、大きくて重いので 80）
QUALITY=90
enc() {
  local in="$1" insize="$2" out="$3" outsize="$4" got
  shift 4
  [ -f "$in" ] || { echo "NG: ${in} がありません"; exit 1; }
  got="$(size_of "$in")"
  [ "$got" = "$insize" ] || { echo "NG: ${in} の大きさが ${got} です（${insize} のはず）"; exit 1; }
  cwebp -quiet -q "$QUALITY" -m 6 -alpha_q 100 -sharp_yuv -metadata none "$@" "$in" -o "$out"
  got="$(size_of "$out")"
  [ "$got" = "$outsize" ] || { echo "NG: ${out} の大きさが ${got} です（${outsize} のはず）"; exit 1; }
}

# --- kun/：部品（748×522 → 374×261）。書き出す名前:素材集の名前（kun_◯◯.webp）
KUN_PARTS="foot-l:footL foot-r:footR arm-l:armL arm-r:armR body:body cheeks:cheeks_normal
eyes-open:eyes_open eyes-half:eyes_half eyes-closed:eyes_closed eyes-left:eyes_left eyes-right:eyes_right eyes-wide:eyes_wide
mouth-rest:mouth_rest mouth-dot:mouth_dot mouth-o:mouth_o
mouth-talk-a:mouth_talk_a mouth-talk-i:mouth_talk_i mouth-talk-o:mouth_talk_o mouth-talk-n:mouth_talk_n"
for p in $KUN_PARTS; do
  enc "$RIG/kun_${p#*:}.webp" 748x522 "$TMP/out/kun/${p%%:*}.webp" 374x261 -resize 374 261
done

# --- chan/：太ももまで（566×800 → 340×480）。1 枚が大きいので品質 80（拡大して見比べても 90 と見分けがつかない）
QUALITY=80
for p in stand:stand reach:reach reach-wink:reach_wink; do
  enc "$THIGH/chan_thigh_${p#*:}.webp" 566x800 "$TMP/out/chan/thigh-${p%%:*}.webp" 340x480 -resize 340 480
done
QUALITY=90

# --- talk/：すてぶるちゃんの顔（660×640 から、以前の face-chan-*.webp と同じ範囲を 112×112 に）
for e in normal proud troubled serious; do
  for n in 0 1 2; do
    enc "$UPPER/chan_${e}_${n}.webp" 660x640 "$TMP/out/talk/chan-${e}-${n}.webp" 112x112 -crop 46 14 572 572 -resize 112 112
  done
  enc "$UPPER/chan_blink_${e}.webp" 660x640 "$TMP/out/talk/chan-blink-${e}.webp" 112x112 -crop 46 14 572 572 -resize 112 112
done

# --- talk/：すてぶるくんの顔。部品を原寸で奥から重ね、上に 31px の透明の余白を足して 748×600 に広げ、顔の範囲を切り出す
for n in footL footR armL armR body cheeks_normal eyes_open eyes_wide eyes_closed mouth_rest mouth_o mouth_talk_a mouth_talk_i mouth_talk_o mouth_talk_n; do
  [ -f "$RIG/kun_$n.webp" ] || { echo "NG: ${RIG}/kun_${n}.webp がありません"; exit 1; }
  dwebp -quiet "$RIG/kun_$n.webp" -o "$TMP/png/$n.png"
done
kun_face() { # 目 口 書き出す名前
  ffmpeg -v error -y -nostdin \
    -i "$TMP/png/footL.png" -i "$TMP/png/footR.png" -i "$TMP/png/armL.png" -i "$TMP/png/armR.png" \
    -i "$TMP/png/body.png" -i "$TMP/png/cheeks_normal.png" -i "$TMP/png/eyes_$1.png" -i "$TMP/png/mouth_$2.png" \
    -filter_complex "[0][1]overlay=format=auto[a];[a][2]overlay=format=auto[b];[b][3]overlay=format=auto[c];[c][4]overlay=format=auto[d];[d][5]overlay=format=auto[e];[e][6]overlay=format=auto[f];[f][7]overlay=format=auto,pad=748:600:0:31:color=black@0,format=rgba" \
    -frames:v 1 -update 1 "$TMP/face.png"
  enc "$TMP/face.png" 748x600 "$TMP/out/talk/$3.webp" 112x112 -crop 79 0 590 590 -resize 112 112
}
kun_face open rest kun-open-rest
kun_face open o kun-open-o
kun_face wide o kun-wide-o
kun_face closed rest kun-closed-rest
kun_face closed o kun-closed-o
for m in a i o n; do
  kun_face open "talk_$m" "kun-open-talk-$m"
  kun_face wide "talk_$m" "kun-wide-talk-$m"
done

# --- 出来上がりを置く。書き出しが途中で失敗したときは、ここまで来ないので assets/char/ は変わらない
#     （置いている途中で止まったときは、新旧が混ざるので、もう一度流す）
mkdir -p "$OUT/kun" "$OUT/chan" "$OUT/talk"
count=0
bytes=0
for d in kun chan talk; do
  n=0
  for f in "$TMP/out/$d"/*.webp; do
    cp "$f" "$OUT/$d/"
    n=$((n + 1))
    bytes=$((bytes + $(wc -c < "$f")))
  done
  echo "${d}/: ${n} 枚 -> ${OUT}/${d}/"
  count=$((count + n))
done
[ "$count" -eq 51 ] || { echo "NG: 書き出した枚数が ${count} です（51 枚のはず）"; exit 1; }
echo "合計: ${count} 枚、${bytes} バイト"
