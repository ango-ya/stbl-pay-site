/* ============================================================
   旧ブラウザ検知 — 3ページ共通（§3.5）
   パスキー（WebAuthn）・CSPRNG・sessionStorage・CSS Grid のいずれかを
   欠くブラウザでは正しく動作しないため、ページ先頭に警告バナーを出す。
   ============================================================ */
(function () {
  "use strict";
  var ok = false;
  try {
    ok = !!(
      window.PublicKeyCredential &&
      window.crypto && window.crypto.getRandomValues &&
      window.sessionStorage &&
      window.CSS && CSS.supports && CSS.supports("display", "grid")
    );
  } catch (e) { ok = false; }
  if (ok) return;
  var bar = document.createElement("div");
  bar.className = "compat-warning";
  bar.setAttribute("role", "alert");
  bar.textContent =
    "お使いのブラウザは古いため、このページが正しく動作しない可能性があります。最新版のブラウザ（Chrome / Safari / Edge / Firefox）でのご利用をおすすめします。";
  if (document.body) document.body.insertBefore(bar, document.body.firstChild);
})();
