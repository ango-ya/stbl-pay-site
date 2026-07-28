#!/usr/bin/env bash
# 受入基準の静的 assertion（設計 §10）。
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
assert_absent() { # file pattern message
  if grep -nE -- "$2" "$ROOT/$1" >/dev/null 2>&1; then
    echo "NG: $3 ($1 に /$2/ が残存)"; grep -nE -- "$2" "$ROOT/$1" | sed 's/^/    /'; fail=1
  fi
}
assert_present() { # file pattern message
  if ! grep -nE -- "$2" "$ROOT/$1" >/dev/null 2>&1; then
    echo "NG: $3 ($1 に /$2/ が無い)"; fail=1
  fi
}

# index.html / app.js に決済ロジック・金額ハードコードが残っていない
assert_absent "assets/app.js" "AMOUNT[[:space:]]*=[[:space:]]*1980" "app.js に金額ハードコードが残存"
assert_absent "index.html" "jpycModal|passkeyDialog" "index.html に決済モーダル/偽パスキー DOM が残存"
assert_present "assets/app.js" "intent:" "app.js に intent 発行が無い"
assert_present "assets/app.js" "pay.html\\?payment_intent_id=" "app.js に pay.html 遷移が無い"

# 内容確認とパスキーは pay 側でのみ
assert_present "pay.html" "." "pay.html が存在しない"
assert_present "assets/pay.js" "navigator.credentials" "pay.js に実パスキー呼び出しが無い"
assert_absent "assets/app.js" "navigator.credentials" "app.js にパスキー呼び出しが残存（pay 側のみのはず）"

if [ "$fail" -ne 0 ]; then echo "受入チェック失敗"; exit 1; fi
echo "受入チェック OK"
