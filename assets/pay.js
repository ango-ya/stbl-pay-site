/* ============================================================
   すてぶるペイ — 専用決済ページ（暗号屋 origin 相当・設計 §3）
   責務: payment_intent 取得 → 1画面で内容確認＋支払い（パスキー）→
        完了表示 → JPYC EX（振込先案内）へ → 加盟店へ結果のみ返す。
   画面は 1 枚・4 ステート（確認 / 処理中 / 完了 / 失敗）で遷移する（計画 §3.6）。
   ============================================================ */
(function () {
  "use strict";

  // ---- クリックジャッキング対策 ----
  if (self !== top) {
    try { document.documentElement.style.display = "none"; } catch (e) {}
    try { top.location = self.location; } catch (e) {}
  }
  // ---- Trusted Types ----
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    try {
      window.trustedTypes.createPolicy("default", {
        createHTML: (s) => String(s)
          .replace(/<\s*(\/?\s*(script|svg|math|iframe|object|embed|link|base)\b)/gi, "&lt;$1")
          .replace(/([\s/])on[a-z]+\s*=/gi, "$1data-x="),
        createScript: () => { throw new TypeError("TT: dynamic script forbidden"); },
        createScriptURL: () => { throw new TypeError("TT: dynamic scriptURL forbidden"); },
      });
    } catch (e) {}
  }

  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  const yen = (n) => "¥" + Number(n).toLocaleString("ja-JP", { maximumFractionDigits: 2 });

  const $card = document.getElementById("payCard");
  const params = new URLSearchParams(location.search);
  const REAL_PASSKEY = params.get("passkey") === "real";
  const ENROLL_KEY = REAL_PASSKEY ? "pay-cred-id" : "pay-mock-enrolled";
  const RETURNING = !!localStorage.getItem(ENROLL_KEY);  // 1決済=1モード（先頭で確定）

  // ---- intent 取得（金額・明細の権威は intent 側。URL には id のみ）----
  function loadIntent() {
    const id = params.get("payment_intent_id") || "";
    if (!/^pi_[0-9a-f]{12}$/.test(id)) return null;       // id 正規形でなければ不採用
    try {
      const raw = sessionStorage.getItem("intent:" + id);
      if (!raw) return null;
      const o = JSON.parse(raw);
      const amount = Number(o.amount);
      // 最低お支払い金額 3,000 円（JPYC の利用制限）〜 上限 1,000 万円
      if (!Number.isFinite(amount) || amount < 3000 || amount > 10000000) return null;
      // 明細の検証: 形式が正しく、合計が amount と一致する場合のみ採用（購入内容の整合性）。
      // sku は商品画像表示用。allowlist 外は既定サムネイルへフォールバック。
      const SKU_ALLOW = ["ebook", "video", "preset"];
      let items = null;
      if (Array.isArray(o.items) && o.items.length > 0 && o.items.length <= 10) {
        const cleaned = [];
        let sum = 0;
        for (const it of o.items) {
          const name = typeof it.name === "string" ? it.name.slice(0, 60) : null;
          const qty = Number(it.qty);
          const price = Number(it.price);
          if (!name || !Number.isInteger(qty) || qty < 1 || qty > 99) { sum = NaN; break; }
          if (!Number.isFinite(price) || price <= 0 || price > 10000000) { sum = NaN; break; }
          cleaned.push({ name, qty, price, sku: SKU_ALLOW.includes(it.sku) ? it.sku : "item" });
          sum += price * qty;
        }
        if (sum === amount) items = cleaned;
      }
      return {
        id,
        amount,
        items,
        merchant: typeof o.merchant === "string" ? o.merchant.slice(0, 60) : "加盟店",
      };
    } catch (e) { return null; }
  }
  // return_url は同一 origin の相対パスのみ許可（open redirect 防止）。
  function safeReturnUrl() {
    const r = params.get("return_url") || "/demo";
    let dec;
    try { dec = decodeURIComponent(r); } catch (e) { return "/demo"; }
    // 相対パスのみ許可: スキーム(:)・プロトコル相対(//)・バックスラッシュ・制御/空白・記号注入を拒否
    if (/[:\\]/.test(dec) || /^\/\//.test(dec) || /[\s<>"'`]/.test(dec)) return "/demo";
    if (!/^[\w./?=&%-]+$/.test(r)) return "/demo";
    return r;
  }

  const intent = loadIntent();
  const RETURN_URL = safeReturnUrl();
  const REPEAT_JPYC_BALANCE_AMOUNT = 1000;
  function paymentAllocationKey() {
    return intent ? "payment-allocation:" + intent.id : "";
  }
  function loadPaymentAllocation() {
    if (!intent) return { balanceAmount: 0, issueAmount: 0 };
    const fallback = {
      balanceAmount: RETURNING ? REPEAT_JPYC_BALANCE_AMOUNT : 0,
      issueAmount: Math.max(intent.amount - (RETURNING ? REPEAT_JPYC_BALANCE_AMOUNT : 0), 0),
    };
    try {
      const raw = sessionStorage.getItem(paymentAllocationKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        const balanceAmount = Number(parsed.balanceAmount);
        const issueAmount = Number(parsed.issueAmount);
        if (Number.isFinite(balanceAmount) && balanceAmount >= 0 &&
            Number.isFinite(issueAmount) && issueAmount >= 0 &&
            balanceAmount + issueAmount === intent.amount) {
          return { balanceAmount, issueAmount };
        }
      }
      sessionStorage.setItem(paymentAllocationKey(), JSON.stringify(fallback));
    } catch (e) {}
    return fallback;
  }
  const PAYMENT_ALLOCATION = loadPaymentAllocation();
  const JPYC_BALANCE_AMOUNT = PAYMENT_ALLOCATION.balanceAmount;
  const ISSUE_AMOUNT = PAYMENT_ALLOCATION.issueAmount;
  // ?passkey=real はデモ用モードフラグ。EC への復路にも引き継ぎ、リピーター（get() 実発火）
  // デモが 2 周目以降モックへ落ちないようにする。
  function ecHref() {
    if (!REAL_PASSKEY) return RETURN_URL;
    return RETURN_URL + (RETURN_URL.includes("?") ? "&" : "?") + "passkey=real";
  }

  // ヘッダーの「ECサイトに戻る」リンク（cancel_url 相当・離脱導線を常設）
  const $back = document.getElementById("backToShop");
  if ($back) $back.setAttribute("href", ecHref());

  function renderError(msg) {
    $card.innerHTML = `
      <h1>お支払いを開始できません</h1>
      <p class="ex-sub">${esc(msg)}</p>
      <div class="ex-actions end">
        <a class="btn ex-btn" href="${esc(ecHref())}">ECサイトに戻る</a>
      </div>`;
  }

  // ---- 仕組み説明ツールチップ（計画 §3.6.5: 本文は平易・解説はホバー/タップ/フォーカスで）----
  function tip(text) {
    return '<span class="tip" tabindex="0" role="button" aria-label="仕組みの説明">' +
      '<span class="tip-icon" aria-hidden="true">ⓘ</span>' +
      '<span class="tip-bubble" role="tooltip">' + esc(text) + '</span></span>';
  }
  const TIP_JPYC = "JPYC は 1 JPYC = 1 円 の日本円ステーブルコインです。銀行振込で JPYC を購入し、そのまま加盟店へのお支払いに使われます。";
  const TIP_PASSKEY = "パスキーはパスワードに代わる簡単で安全なログイン手段です。お使いの端末に保存され、指紋そのものやパスワードがネットワークに送られることはありません。";
  const TIP_FEE = "すてぶるペイでの最低お支払い金額は 3,000 円です。";
  // JPYC EX 公式ロゴ（jpyc.co.jp 由来。使用条件は JPYC 社ブランド確認対象）
  const EX_LOGO = '<img class="ex-note-logo" src="assets/img/jpycex-logo.png" alt="JPYC EX" />';
  const JPYC_EX_AUTH_PENDING = params.get("jpyc_ex_auth") === "pending";

  // ---- 初回①ビュー: JPYC EX アカウント開設のご案内 ----
  // なぜ開設が必要か（JPYC で支払う／JPYC はご自身の JPYC EX アカウントで銀行振込により
  // 発行する）を伝え、「まず開設頑張って」と後押しする。パスキー（支払い認証）はここでは
  // 行わず、開設完了後に戻る③（決済確認&認証）で行う。
  function viewGuide() {
    return `
      <div class="pay-kicker"><span>STBLpay checkout</span><span>01</span></div>
      <h1>JPYC EX アカウント開設のご案内</h1>
      <p class="pay-merchant">支払い先 <strong>${esc(intent.merchant)}</strong> / ${yen(intent.amount)}</p>
      <div class="pay-note" id="payNote">
        ${EX_LOGO}
        <div class="first-note">
          <p>このお支払いに使う JPYC（1 JPYC = 1 円の日本円ステーブルコイン）は、ご自身の JPYC EX アカウントで銀行振込により発行（購入）するため、<strong>初回のみ</strong> JPYC EX アカウントの開設を行います。</p>
        </div>
      </div>
      <ol class="guide-steps">
        <li><span class="guide-step-num">1</span><span>JPYC EX アカウント作成</span></li>
        <li><span class="guide-step-num">2</span><span>本人確認（eKYC）</span></li>
        <li><span class="guide-step-num">3</span><span>振込元の銀行口座を登録</span></li>
      </ol>
      <p class="guide-note">開設はこの 3 ステップです。</p>
      <button type="button" class="pay-cta" id="guideBtn">
        <span class="pay-cta-label">JPYC EX アカウント開設を始める</span>
      </button>
      <p class="powered">Powered by すてぶるペイ</p>`;
  }

  // ---- 決済確認ビュー（明細は出さず合計のみ表示・パスキーで確定）----
  // 2周目①（RETURNING）と、初回③（afterAuth: JPYC EX 開設完了後の戻り）で共用する。
  // afterAuth 時は先頭に開設完了バナー（＝認証確認）を出し、続けて支払いを確定させる。
  function viewPayment(afterAuth, opened) {
    const jpycBalance = Number(JPYC_BALANCE_AMOUNT).toLocaleString("ja-JP") + " JPYC";
    const issueLabel = RETURNING ? "不足分のJPYC発行申請" : "JPYC発行申請金額";
    const ctaLabel = RETURNING
      ? "銀行振込でJPYC発行申請 " + yen(ISSUE_AMOUNT)
      : "銀行振込でJPYC支払い " + yen(ISSUE_AMOUNT);
    const kicker = afterAuth ? "02" : "01";
    // afterAuth（初回③）: JPYC EX 開設完了のコールバックが検証できた時のみ完了バナーを出す。
    const banner = (afterAuth && opened)
      ? `<div class="pay-done-banner"><span class="pay-done-check" aria-hidden="true">✓</span>JPYC EX アカウントの開設が完了しました</div>`
      : "";
    const noteHtml = afterAuth
      ? `${banner}<div class="first-note"><p>次に JPYC EX で振込先をご案内します。</p></div>`
      : `<div class="first-note"><p>次に JPYC EX で振込先をご案内します。</p></div>`;
    return `
      <div class="pay-kicker"><span>STBLpay checkout</span><span>${kicker}</span></div>
      <h1>お支払い内容の確認</h1>
      <p class="pay-merchant">支払い先 <strong>${esc(intent.merchant)}</strong> / JPYC でのお支払い${tip(TIP_JPYC)}</p>
      <div class="order-list">
        <div class="order-total">
          <span>合計お支払い金額${tip(TIP_FEE)}</span>
          <span class="order-amount">${yen(intent.amount)}</span>
        </div>
        <div class="wallet-balance" aria-label="JPYC残高">
          <span>JPYC残高</span>
          <strong>${jpycBalance}</strong>
        </div>
        <div class="wallet-balance" aria-label="${esc(issueLabel)}">
          <span>${esc(issueLabel)}</span>
          <strong>${yen(ISSUE_AMOUNT)}</strong>
        </div>
      </div>
      <div class="pay-note" id="payNote">
        ${EX_LOGO}
        ${noteHtml}
      </div>
      <div class="callout warn pay-error" id="payError" hidden>
        <span aria-hidden="true">⚠</span>
        <div>認証を完了できませんでした。もう一度お試しください。</div>
      </div>
      <button type="button" class="pay-cta" id="payBtn">
        <span class="pay-cta-spinner spinner" aria-hidden="true" hidden></span>
        <span class="pay-cta-check" aria-hidden="true" hidden>✓</span>
        <span class="pay-cta-label">${esc(ctaLabel)}</span>
      </button>
      <p class="pay-status" id="payStatus" role="status" aria-live="polite"></p>
      <p class="trust-note">指紋の情報はこのデバイスの中だけで使われ、お店にも当社にも送信されません。${tip(TIP_PASSKEY)}</p>
      <p class="powered">Powered by すてぶるペイ</p>`;
  }

  // ---- base64url 変換 ----
  function b64url(buf) {
    const bytes = new Uint8Array(buf);
    let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromB64url(str) {
    const s = str.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(s + "===".slice((s.length + 3) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }
  function randBytes(n) { const a = new Uint8Array(n); window.crypto.getRandomValues(a); return a; }

  // ---- 往路ユーティリティ ----
  const NETWORK = "Polygon";
  function pseudoHex(len) {
    const chars = "0123456789abcdef"; let s = "";
    const r = randBytes(len);
    for (let i = 0; i < len; i++) s += chars[r[i] % 16];
    return s;
  }
  function pseudoNamekey() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = "";
    const r = randBytes(4); for (let i = 0; i < 4; i++) s += chars[r[i] % chars.length];
    return s;
  }
  function buildReservation() {
    return {
      reservationId: "JE" + String(Date.now()).slice(-8) + pseudoHex(4).toUpperCase(),
      virtualNamekey: pseudoNamekey(),
      reservedBank: {
        bank: "GMOあおぞらネット銀行", branch: "法人営業部", type: "普通",
        account: "2008" + (300 + (randBytes(1)[0] % 700)),
        holder: "ｶ)ｼﾞｪｲﾋﾟｰﾜｲｼｰｲｰｴｯｸｽ",
      },
      amount: ISSUE_AMOUNT,
      network: NETWORK,
      recvWallet: "0x" + pseudoHex(40),
    };
  }
  function jpycExBaseParams() {
    const q = new URLSearchParams({
      amount: String(ISSUE_AMOUNT),
      network: NETWORK,
      return_to: RETURN_URL,
      payment_intent_id: intent.id,
    });
    if (REAL_PASSKEY) q.set("passkey", "real"); // 復路までモードを維持（jpyc-ex が EC へ中継）
    return q;
  }
  function goToJpycExAuth() {
    const q = jpycExBaseParams();
    location.href = "jpyc-ex.html?" + q.toString();
  }
  function goToJpycExAfterReservation(payload) {
    const q = jpycExBaseParams();
    q.set("mode", "post-reservation");
    q.set("wallet", payload.recvWallet);
    q.set("reservationId", payload.reservationId);
    location.href = "jpyc-ex.html?" + q.toString();
  }
  // 発行申請予約を作成し、JPYC EX の振込先案内へ直接遷移する。
  function goToJpycExReservation() {
    const payload = buildReservation();
    sessionStorage.setItem("jpyc-ex-payload", JSON.stringify(payload));
    goToJpycExAfterReservation(payload);
  }

  function authCallbackKey() {
    return "jpyc-ex-auth-callback:" + intent.id;
  }
  function readAuthCallback() {
    try {
      const raw = sessionStorage.getItem(authCallbackKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.status === "received" && parsed.verified ? parsed : null;
    } catch (e) {
      return null;
    }
  }
  // ---- 偽 Touch ID ダイアログ（既定モック）----
  // 初回はパスキーの「登録」であることが分かる文言に出し分ける（実 WebAuthn の
  // create()/get() の違いに対応。?passkey=real 時は OS ダイアログが同じ役割を担う）。
  function runMockPasskey() {
    const $dlg = document.getElementById("passkeyDialog");
    const $ok = document.getElementById("passkeyConfirm");
    const $cancel = document.getElementById("passkeyCancel");
    if (!$dlg || !$ok || !$cancel) return Promise.resolve(false);
    const $title = document.getElementById("passkeyTitle");
    const $desc = document.getElementById("passkeyDesc");
    if (!RETURNING) {
      if ($title) $title.textContent = "パスワードなしでログイン";
      if ($desc) $desc.textContent = "パスキーというパスワードに代わる簡単で安全な\nログイン手段を使ってログインします";
      $ok.textContent = "登録する";
    } else {
      if ($title) $title.textContent = "パスワードなしでログイン";
      if ($desc) $desc.textContent = "パスキーというパスワードに代わる簡単で安全な\nログイン手段を使ってログインします";
      $ok.textContent = "認証する";
    }
    return new Promise((resolve) => {
      let done = false;
      const close = (result) => {
        if (done) return; done = true;
        $dlg.classList.remove("open");
        $ok.removeEventListener("click", onOk);
        $cancel.removeEventListener("click", onCancel);
        resolve(result);
      };
      const onOk = () => { localStorage.setItem("pay-mock-enrolled", "1"); close(true); };
      const onCancel = () => close(false);
      $ok.addEventListener("click", onOk);
      $cancel.addEventListener("click", onCancel);
      $dlg.classList.add("open");
    });
  }

  async function runPasskey() {
    if (!REAL_PASSKEY) return runMockPasskey();
    // challenge は CSPRNG で都度生成（SEC-005a 簡易版）。origin は WebAuthn が自動検証。
    const challenge = randBytes(32);
    const existing = localStorage.getItem("pay-cred-id");
    // PRF 拡張は「形だけ」付与（実派生はモック・スコープ外）。
    const prfExt = { prf: { eval: { first: randBytes(32) } } };
    try {
      if (!existing) {
        // 初回 = パスキー作成（＝支払い元の確定）。
        const cred = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { id: location.hostname, name: "すてぶるペイ" },
            user: { id: randBytes(16), name: "user@demo", displayName: "すてぶるペイ ユーザー" },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            authenticatorSelection: { userVerification: "required", residentKey: "preferred" },
            timeout: 60000,
            extensions: prfExt,
          },
        });
        if (!cred) throw new Error("no credential");
        localStorage.setItem("pay-cred-id", b64url(cred.rawId));
      } else {
        // リピーター = 既存パスキーで支払いを確定（送金指図に相当）。
        await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials: [{ id: fromB64url(existing), type: "public-key" }],
            userVerification: "required",
            timeout: 60000,
            extensions: prfExt,
          },
        });
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---- ステート制御（確認 → 処理中 → 完了 / 失敗。1 画面内で完結）----
  function setLoading(loading) {
    const $btn = document.getElementById("payBtn");
    const $spin = $card.querySelector(".pay-cta-spinner");
    const $label = $card.querySelector(".pay-cta-label");
    if (!$btn) return;
    $btn.disabled = loading;               // 二重送信防止
    $btn.classList.toggle("loading", loading);
    if ($spin) $spin.hidden = !loading;
    if ($label) $label.hidden = loading;
  }

  function showSuccess() {
    const $btn = document.getElementById("payBtn");
    const $spin = $card.querySelector(".pay-cta-spinner");
    const $check = $card.querySelector(".pay-cta-check");
    const $label = $card.querySelector(".pay-cta-label");
    const $status = document.getElementById("payStatus");
    if ($btn) { $btn.disabled = true; $btn.classList.remove("loading"); $btn.classList.add("success"); }
    if ($spin) $spin.hidden = true;
    if ($label) $label.hidden = true;
    if ($check) $check.hidden = false;
    if ($status) $status.textContent = "";
  }

  function showFailure() {
    const $err = document.getElementById("payError");
    if ($err) $err.hidden = false;
    setLoading(false);                     // ボタンは即時再有効化・同一画面に留まる
    $card.classList.remove("shake");
    // 再トリガーのため reflow を挟む
    void $card.offsetWidth;
    $card.classList.add("shake");
  }

  // 決済確認ビューでの確定操作。パスキー成功後は必ず振込先案内（予約）へ進む。
  // このビューは 2周目① と 初回③（開設完了後）でのみ表示されるため、遷移先は
  // どちらも goToJpycExReservation で一本化できる。
  function onPay() {
    const $err = document.getElementById("payError");
    if ($err) $err.hidden = true;
    setLoading(true);
    runPasskey().then((ok) => {
      if (!ok) { showFailure(); return; }
      showSuccess();
      setTimeout(goToJpycExReservation, 1000);
    });
  }

  function renderGuide() {
    $card.innerHTML = viewGuide();
    const $btn = document.getElementById("guideBtn");
    // 開設案内のCTAはパスキーを挟まず JPYC EX 開設フローへ直行する。
    if ($btn) $btn.addEventListener("click", () => { goToJpycExAuth(); });
  }

  function renderPayment(afterAuth) {
    // 初回③のみ、JPYC EX 開設完了コールバックの検証結果を完了バナー表示に反映する。
    const opened = afterAuth && !!readAuthCallback();
    $card.innerHTML = viewPayment(afterAuth, opened);
    const $btn = document.getElementById("payBtn");
    if ($btn) $btn.addEventListener("click", onPay);
  }

  function render() {
    if (!intent) { renderError("お支払い情報が見つかりません"); return; }
    // 初回③: JPYC EX 開設完了後に戻る。決済確認&認証（パスキー）→ 振込先案内へ。
    if (JPYC_EX_AUTH_PENDING) { renderPayment(true); return; }
    // 初回①: 開設案内。2周目①: 決済確認（1画面のまま）。
    if (!RETURNING) { renderGuide(); return; }
    renderPayment(false);
  }

  // ---- boot ----
  render();
})();
