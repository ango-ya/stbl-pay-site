#!/usr/bin/env bash
# つかいかた動画の mp4（assets/video/ の 10 本）を、Cloudflare R2 に上げる。
#
#   ./scripts/upload-videos-r2.sh [版]
#
# - 版は YYYY-MM-DD。省略すると今日の日付。mp4 は how/<版>/how-NN.mp4 に置く。
#   動画を作り直したら版を変える。同じパスには上書きしない（1 年キャッシュさせるため）。
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
VERSION="${1:-$(date +%F)}"
R2_BUCKET="${R2_BUCKET:-stbl-pay-media}"
MEDIA_ORIGIN="${MEDIA_ORIGIN:-https://media.stbl-pay.com}"
MEDIA_ORIGIN="${MEDIA_ORIGIN%/}"

FILES="how-00.mp4 how-01.mp4 how-02.mp4 how-03.mp4 how-04.mp4 how-05.mp4 how-06.mp4 how-07.mp4 how-08.mp4 how-08en.mp4"

case "$VERSION" in
  [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
  *) echo "NG: 版は YYYY-MM-DD の形で指定してください（指定: ${VERSION}）"; exit 1 ;;
esac

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

# 2. 同じ版のパスに、もう公開されていないか（上書き防止）
echo "公開 URL に同じ版が無いか確かめます: ${MEDIA_ORIGIN}/how/${VERSION}/"
clash=""
unknown=""
for f in $FILES; do
  url="$MEDIA_ORIGIN/how/$VERSION/$f"
  code="$(curl -sI -o /dev/null -w '%{http_code}' --max-time 20 "$url" || true)"
  case "$code" in
    200) clash="$clash $f" ;;
    404) ;;
    *) unknown="$unknown $f($code)" ;;
  esac
done
if [ -n "$clash" ]; then
  echo "NG: 同じ版のパスに上書きしない。版を変えてください。（もう公開されている:${clash}）"
  exit 1
fi
if [ -n "$unknown" ]; then
  echo "NG: 公開 URL の様子が分からず、上書きでないと言い切れません:${unknown}"
  echo "    独自ドメインがつながっているか（${MEDIA_ORIGIN}）、通信できているかを確かめてください。"
  exit 1
fi

# 3. 上げる
n=0
total=10
for f in $FILES; do
  n=$((n + 1))
  echo "[$n/$total] upload: $R2_BUCKET/how/$VERSION/$f"
  npx wrangler r2 object put "$R2_BUCKET/how/$VERSION/$f" \
    --file "$VIDEO_DIR/$f" \
    --content-type video/mp4 \
    --cache-control "public, max-age=31536000, immutable" \
    --remote || {
    echo "NG: $f を上げられませんでした。"
    echo "    途中まで上がっているので、同じ版ではやり直さず、版を変えて最初からやり直してください。"
    exit 1
  }
done

BASE="$MEDIA_ORIGIN/how/$VERSION/"
echo
echo "上げ終わりました。次に打つコマンド:"
echo "  node scripts/set-video-base.mjs $BASE"
echo "  ./scripts/check-video-cdn.sh $BASE"
echo "そのあと index.html と en/index.html をコミットしてください。"
