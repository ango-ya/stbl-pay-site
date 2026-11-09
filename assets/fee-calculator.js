// 決済手数料の総コスト計算（/learn/payment-fees/）。表示は textContent のみ。値は入力されたものだけを使う。
(function () {
  var LABELS = {
    sales: "月の売上", count: "月の決済件数", rate: "決済手数料の料率", fixed: "1 件ごとの固定の手数料",
    monthly: "月額の基本料金", payouts: "月の入金回数", transfer: "1 回の振込手数料"
  };
  var yen = function (n) { return n.toLocaleString("ja-JP") + " 円"; };

  // raw: 各欄の文字列。数値として読めない欄は null。未入力は 0、負の値・数値でない値は 0 にして bad に入れる
  function calc(raw) {
    var v = {}, bad = [];
    Object.keys(LABELS).forEach(function (k) {
      var s = raw[k], n = 0;
      if (s === null) bad.push(k);
      else if (String(s).trim() !== "") {
        n = Number(s);
        if (!isFinite(n) || n < 0) { n = 0; bad.push(k); }
      }
      v[k] = n;
    });
    var parts = {
      rate: Math.round(v.sales * v.rate / 100),
      fixed: Math.round(v.count * v.fixed),
      monthly: Math.round(v.monthly),
      transfer: Math.round(v.payouts * v.transfer)
    };
    var total = parts.rate + parts.fixed + parts.monthly + parts.transfer;
    var ratio = v.sales > 0 ? (total / v.sales * 100).toFixed(2) + "%" : "—";
    return { parts: parts, total: total, ratio: ratio, bad: bad.map(function (k) { return LABELS[k]; }) };
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
    var warn = document.getElementById("fc-warn");
    warn.textContent = r.bad.length ? "注意：" + r.bad.join("、") + "は、負の値か数値でないため 0 として計算しました。" : "";
    warn.hidden = !r.bad.length;
  }

  Object.keys(els).forEach(function (k) { els[k].addEventListener("input", render); });
  render();
})();
