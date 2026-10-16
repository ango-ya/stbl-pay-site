#!/usr/bin/env bash
# つかいかた動画の mp4（assets/video/ の 10 本）を、Cloudflare R2 に上げる。
#
#   ./scripts/upload-videos-r2.sh [YYYY-MM-DD] [--dry-run]
#
# - 上げる前の写しで計算して、その写しを送る。元のファイルを作り直しても、上がるのは計算した中身。
#     最初に 10 本を mktemp -d の一時フォルダへ cp で写す（終わるときに、失敗や中断でも必ず消す）。
#     ハッシュの計算も、HEAD の確認のあとのアップロードも、この写しからだけ行う。
#     元の assets/video/ を読むのは、写すときだけ。--dry-run も同じ写しで版を計算する。
#     一時フォルダには mp4 10 本ぶんの空きが要る（約 125MB。場所は環境変数 TMPDIR で変えられる）。
# - 版は <日付>-<中身のハッシュ 16 桁>（例：2026-10-16-1a2b3c4d5e6f7a8b）。mp4 は how/<版>/how-NN.mp4 に置く。
#     日付：引数で決める。省略すると今日。
#     ハッシュ：10 本（how-00 … how-08, how-08en の順）について、1 行ずつ
#       「そのファイルの sha256（16 進 64 桁）、半角スペース 2 つ、ファイル名」
#       を並べたテキスト（各行は LF で終わる）の sha256 の先頭 16 桁（小文字）。
#   中身が変われば版も変わる。同じ版のパスに違う中身が載ることは、ハッシュの衝突
#   （16 桁なので実用上は起きない）が無い限り無い。
#   だから 1 年キャッシュ（immutable）させても、作り直した動画が古いまま残ることはない。
#   同じ版をもう一度上げても、衝突が無い限り中身は同じなので、上書きしても害がない。
# - 上げる前に、公開 URL へ HEAD を送る。200 は「もう上がっている（同じ中身）」として飛ばし、404 は上げる。
#   それ以外（000・403・5xx など）は様子が分からないので止まる。
#   この確認は上書きを防ぐためではなく、上がっているものを飛ばして時間を省くためのもの。
#   キャッシュされた 404 のせいで上げ直しても、同じ中身なので害がない。
# - --dry-run：10 本の確認と版の計算だけをして、版・ベース URL・次に打つコマンドを表示して終わる
#   （HEAD もアップロードもしない）。
# - 日付を省略したまま日をまたぐと版が変わる。やり直すときは、表示された日付を付けて打つ。
# - 計算を始めてから check-video-cdn.sh が 0 になるまで、assets/video/ の mp4 を作り直さない。
#   作り直すと、アップロードした中身と、check-video-cdn.sh が見比べる手元のファイルがずれる。
#   作り直したら、--dry-run からやり直す。
# - 環境変数
#     R2_BUCKET     バケット名（既定 stbl-pay-media）
#     MEDIA_ORIGIN  公開する先のオリジン（既定 https://media.stbl-pay.com）
#     VIDEO_DIR     mp4 を探すフォルダ（既定 assets/video。試すときだけ変える）
# - 認証は wrangler login か、環境変数 CLOUDFLARE_API_TOKEN（複数アカウントなら CLOUDFLARE_ACCOUNT_ID も）。
#   このスクリプトには鍵を書かない。
# - バケット・独自ドメイン・キャッシュルールは、先に stbl-pay-terraform の
#   docs/runbooks/cloudflare-media-r2-setup.md のとおりに作っておく。
# - 上げ終わったら、表示される次のコマンド（set-video-base.mjs と check-video-cdn.sh）を順に打つ。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VIDEO_DIR="${VIDEO_DIR:-$ROOT/assets/video}"
R2_BUCKET="${R2_BUCKET:-stbl-pay-media}"
MEDIA_ORIGIN="${MEDIA_ORIGIN:-https://media.stbl-pay.com}"
MEDIA_ORIGIN="${MEDIA_ORIGIN%/}"

# この並びが、ハッシュの元になるテキストの行の並びになる（変えると版が変わる）
FILES="how-00.mp4 how-01.mp4 how-02.mp4 how-03.mp4 how-04.mp4 how-05.mp4 how-06.mp4 how-07.mp4 how-08.mp4 how-08en.mp4"

usage() {
  echo "使いかた: ./scripts/upload-videos-r2.sh [YYYY-MM-DD] [--dry-run]"
}

# 引数：日付（省略すると今日）と --dry-run。順は問わない
DATE=""
DRY_RUN=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9])
      if [ -n "$DATE" ]; then
        echo "NG: 日付が 2 つ指定されています（${DATE} と ${a}）"
        usage
        exit 1
      fi
      DATE="$a"
      ;;
    *)
      echo "NG: 引数は YYYY-MM-DD の形の日付と --dry-run だけです（指定: ${a}）"
      usage
      exit 1
      ;;
  esac
done
[ -n "$DATE" ] || DATE="$(date +%F)"

# sha256 を標準入力から求める（macOS は shasum、Linux は sha256sum。あるほうを使う）
if command -v shasum >/dev/null 2>&1; then
  sha256_stdin() { shasum -a 256 | awk '{ print $1 }'; }
elif command -v sha256sum >/dev/null 2>&1; then
  sha256_stdin() { sha256sum | awk '{ print $1 }'; }
else
  echo "NG: sha256 を求めるコマンド（shasum か sha256sum）がありません。"
  exit 1
fi

# 小文字の 16 進 64 桁か
is_sha256() {
  [ "${#1}" -eq 64 ] || return 1
  case "$1" in *[!0-9a-f]*) return 1 ;; esac
  return 0
}

# 1. 10 本そろっているか
missing=""
for f in $FILES; do
  [ -f "$VIDEO_DIR/$f" ] || missing="$missing $f"
done
if [ -n "$missing" ]; then
  echo "NG: ${VIDEO_DIR} に mp4 が足りません:${missing}"
  echo "    先に ./scripts/encode-videos.sh <how-series のフォルダ> で作ってください。"
  exit 1
fi

# 2. 10 本を一時フォルダへ写す。以後の計算と送信は、元ではなくこの写しだけから行う
SNAP=""
cleanup() {
  [ -z "$SNAP" ] || rm -rf "$SNAP"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# 場所は TMPDIR（無ければ /tmp）。macOS の mktemp -d は TMPDIR を見ないことがあるので、場所を書いて渡す
tmp_base="${TMPDIR:-/tmp}"
tmp_base="${tmp_base%/}"
SNAP="$(mktemp -d "${tmp_base}/stbl-videos.XXXXXX")" || { echo "NG: 写しを置く一時フォルダを作れませんでした。"; exit 1; }
[ -n "$SNAP" ] && [ -d "$SNAP" ] || { echo "NG: 写しを置く一時フォルダを作れませんでした。"; exit 1; }
echo "mp4 を一時フォルダに写します: ${SNAP}"
for f in $FILES; do
  cp "$VIDEO_DIR/$f" "$SNAP/$f" || { echo "NG: $f を一時フォルダに写せませんでした（空き容量を確かめてください）。"; exit 1; }
done

# 3. 版を決める。写しの sha256 を求め、1 行ずつ「sha256<半角スペース 2 つ>ファイル名」を LF で並べたテキストの
#    sha256 の先頭 16 桁にする
#    （変数に入れた文字列の終わりの LF は残る。コマンド置換で受けると消えるので、直接パイプに渡す）
manifest=""
echo "mp4 の sha256（写しから計算）:"
for f in $FILES; do
  h="$(sha256_stdin < "$SNAP/$f")" || { echo "NG: $f の sha256 を求められませんでした。"; exit 1; }
  is_sha256 "$h" || { echo "NG: $f の sha256 が 16 進 64 桁ではありません（${h}）。"; exit 1; }
  manifest="$manifest$h  $f"$'\n'
  printf '  %s  %s\n' "$h" "$f"
done
all="$(printf '%s' "$manifest" | sha256_stdin)" || { echo "NG: 版のハッシュを求められませんでした。"; exit 1; }
is_sha256 "$all" || { echo "NG: 版のハッシュが 16 進 64 桁ではありません（${all}）。"; exit 1; }
VERSION="${DATE}-${all:0:16}"
BASE="$MEDIA_ORIGIN/how/$VERSION/"

print_next() {
  echo "  node scripts/set-video-base.mjs $BASE"
  echo "  ./scripts/check-video-cdn.sh $BASE"
  echo "check-video-cdn.sh が終了コード 0 になってから、index.html と en/index.html をコミットしてください。"
}

echo
echo "版: ${VERSION}"
echo "ベース URL: ${BASE}"

if [ "$DRY_RUN" -eq 1 ]; then
  echo
  echo "--dry-run なので、HEAD の確認もアップロードもしていません。"
  echo "上げるとき:"
  echo "  ./scripts/upload-videos-r2.sh ${DATE}"
  echo "上げたあとに打つコマンド:"
  print_next
  exit 0
fi

# 4. 公開 URL に、もう上がっているか（200 は飛ばし、404 は上げる。それ以外は止まる）
echo
echo "公開 URL に上がっているか確かめます: ${BASE}"
todo=""
unknown=""
skipped=0
for f in $FILES; do
  url="$BASE$f"
  code="$(curl -sI -o /dev/null -w '%{http_code}' --max-time 20 "$url" || true)"
  case "$code" in
    200) skipped=$((skipped + 1)); echo "  もう上がっています（同じ中身）: $f" ;;
    404) todo="$todo $f" ;;
    *) unknown="$unknown $f(${code:-なし})" ;;
  esac
done
if [ -n "$unknown" ]; then
  echo "NG: 公開 URL の様子が分かりません（200 でも 404 でもない）:${unknown}"
  echo "    独自ドメインがつながっているか（${MEDIA_ORIGIN}）、通信できているかを確かめてください。"
  exit 1
fi

if [ -z "$todo" ]; then
  echo
  echo "10 本とも、もう上がっています（同じ版なら、衝突が無い限り中身も同じ）。上げ直しは要りません。次に打つコマンド:"
  print_next
  exit 0
fi

# 5. 上がっていない分を、写しから上げる
total=0
for f in $todo; do total=$((total + 1)); done
[ "$skipped" -eq 0 ] || echo "  （${skipped} 本は飛ばします）"
n=0
for f in $todo; do
  n=$((n + 1))
  echo "[$n/$total] upload: $R2_BUCKET/how/$VERSION/$f"
  npx wrangler r2 object put "$R2_BUCKET/how/$VERSION/$f" \
    --file "$SNAP/$f" \
    --content-type video/mp4 \
    --cache-control "public, max-age=31536000, immutable" \
    --remote || {
    echo "NG: $f を上げられませんでした。"
    echo "    同じコマンドをもう一度流せば、写しを取り直して版を計算し直し、上がっていない分だけ上げます。"
    echo "    （assets/video/ の mp4 を作り直していなければ同じ版になります。同じ版なら中身も同じなので、上書きしても問題ありません）"
    echo "    ./scripts/upload-videos-r2.sh ${DATE}"
    exit 1
  }
done

echo
echo "上げ終わりました（版: ${VERSION}）。次に打つコマンド:"
print_next
