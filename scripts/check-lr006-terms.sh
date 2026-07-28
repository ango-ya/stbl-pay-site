#!/usr/bin/env bash
# LR-006 禁止語ゲート（設計 §6 / SRS §6.6）。
# ユーザー向け UI ファイルに暗号資産技術用語・誤認語が出ないことを保証する。
# 対象は既定で pay.html / assets/app.js / assets/pay.js（決済フロー UI）。
# LP（index.html）・デモカート画面（demo.html / demo/index.html）は説明的文言を含むため対象外（用語見直しは別 issue で法務確認のうえ判断）。
# 開発者向けコメント・README は対象外（設計 §6）。
export LC_ALL=C
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILES="${CHECK_FILES:-pay.html assets/app.js assets/pay.js}"

# 禁止語（大文字小文字区別。日本語語句はそのまま）。
TERMS=(
  "AA Wallet" "ウォレット" "UserOperation" "UserOp" "秘密鍵" "ガス代"
  "initCode" "bundler" "Meta Transaction" "Meta TX"
  "secp256k1" "ECDSA" "ecrecover" "CREATE2" "EntryPoint" "paymasterAndData"
  "自動送金" "自動引き落とし" "暗号屋残高" "預かり残高" "アカウント残高"
)

fail=0
for f in $FILES; do
  path="$ROOT/$f"
  [ -f "$path" ] || continue
  for t in "${TERMS[@]}"; do
    if grep -nF -- "$t" "$path" >/dev/null 2>&1; then
      echo "NG: 禁止語「$t」が $f に出現:"
      grep -nF -- "$t" "$path" | sed 's/^/    /'
      fail=1
    fi
  done
done

if [ "$fail" -ne 0 ]; then
  echo "LR-006 チェック失敗（禁止語あり）"
  exit 1
fi
echo "LR-006 チェック OK（禁止語 0 件）"
