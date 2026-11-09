// 決済手数料の総コスト計算（/learn/payment-fees/）。表示は textContent のみ。値は入力されたものだけを使う。
(function () {
  var LABELS = {
    sales: "月の売上", count: "月の決済件数", rate: "決済手数料の料率", fixed: "1 件ごとの固定の手数料",
    monthly: "月額の基本料金", payouts: "月の入金回数", transfer: "1 回の振込手数料"
  };
  var INT = { count: true, payouts: true };
  var yen = function (n) { return n === null ? "—" : n.toLocaleString("ja-JP") + " 円"; };

  // 文字列を 100 倍の整数で読む（浮動小数点の誤差で四捨五入がずれないように）。件数・回数は整数だけ、ほかは小数第 2 位まで
  function parse(k, s) {
    if (s === null) return { err: "数値でない" };
    s = String(s).trim();
    if (s === "") return { n: 0 };
    if (/^-/.test(s)) return { err: "負の値" };
    if (INT[k]) return /^\d+$/.test(s) ? { n: Number(s) } : { err: /^\d*\.\d+$/.test(s) ? "整数でない" : "数値でない" };
    var m = /^(\d*)(?:\.(\d*))?$/.exec(s);
    if (!m || (m[1] + (m[2] || "")) === "") return { err: "数値でない" };
    if ((m[2] || "").length > 2) return { err: "小数第 3 位以下がある" };
    return { n: Number(m[1] || "0") * 100 + Number(((m[2] || "") + "00").slice(0, 2)) };
  }

  // raw: 各欄の文字列。ブラウザが数値として読めない欄は null。未入力は 0、正しくない欄は 0 にして bad に入れる
  function calc(raw) {
    var v = {}, bad = [];
    Object.keys(LABELS).forEach(function (k) {
      var p = parse(k, raw[k]);
      if (p.err) bad.push({ key: k, label: LABELS[k], reason: p.err });
      v[k] = p.err ? 0 : p.n;
    });
    // 金額と料率は 100 倍、件数・回数はそのまま。料率の分は 売上×100 × 料率×100 ÷ 1,000,000 円
    var raws = [v.sales * v.rate / 1e6, v.count * v.fixed / 100, v.monthly / 100, v.payouts * v.transfer / 100];
    var products = [v.sales * v.rate, v.count * v.fixed, v.monthly, v.payouts * v.transfer];
    var tooBig = !products.every(Number.isSafeInteger);
    var r = raws.map(Math.round);
    var total = r[0] + r[1] + r[2] + r[3];
    if (!Number.isFinite(total) || !Number.isSafeInteger(total)) tooBig = true;
    if (tooBig) return { parts: { rate: null, fixed: null, monthly: null, transfer: null }, total: null, ratio: "—", bad: bad, tooBig: true };
    var ratio = v.sales > 0 ? (total / (v.sales / 100) * 100).toFixed(2) + "%" : "—";
    return { parts: { rate: r[0], fixed: r[1], monthly: r[2], transfer: r[3] }, total: total, ratio: ratio, bad: bad, tooBig: false };
  }

  if (typeof module !== "undefined") module.exports = { calc: calc };
  if (typeof document === "undefined") return;

  var els = {};
  Object.keys(LABELS).forEach(function (k) { els[k] = document.getElementById("fc-" + k); });
  var set = function (id, text) { document.getElementById(id).textContent = text; };

  function render() {
    var raw = {};
    Object.keys(els).forEach(function (k) {
      raw[k] = els[k].validity && els[k].validity.badInput ? null : els[k].value;
    });
    var r = calc(raw);
    set("fc-total", yen(r.total));
    set("fc-ratio", r.ratio);
    set("fc-b-rate", yen(r.parts.rate));
    set("fc-b-fixed", yen(r.parts.fixed));
    set("fc-b-monthly", yen(r.parts.monthly));
    set("fc-b-transfer", yen(r.parts.transfer));
    var msg = [];
    if (r.bad.length) {
      msg.push("注意：" + r.bad.map(function (b) { return b.label + "（" + b.reason + "）"; }).join("、") +
        "は 0 として計算しました。料率と金額は小数第 2 位まで、件数と回数は整数で入れてください。");
    }
    if (r.tooBig) msg.push("注意：値が大きすぎるため計算できません。");
    var warn = document.getElementById("fc-warn");
    warn.textContent = msg.join("");
    warn.hidden = !msg.length;
    var badKeys = r.bad.map(function (b) { return b.key; });
    Object.keys(els).forEach(function (k) {
      if (badKeys.indexOf(k) >= 0) {
        els[k].setAttribute("aria-invalid", "true");
        els[k].setAttribute("aria-describedby", "fc-warn");
      } else {
        els[k].removeAttribute("aria-invalid");
        els[k].removeAttribute("aria-describedby");
      }
    });
  }

  Object.keys(els).forEach(function (k) { els[k].addEventListener("input", render); });
  render();
})();
