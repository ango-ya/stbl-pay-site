/* ============================================================
   JPYC EX (模擬) ページ
   ============================================================
   入力:
     - 認証モード: URL クエリ amount, network, return_to, payment_intent_id
     - 予約後モード: 上記 + mode=post-reservation + sessionStorage["jpyc-ex-payload"]
   出力:
     - 加盟店ECサイトへ直接復帰: /demo?status=received&payment_intent_id=<id>
       （着金検知→送金→加盟店 webhook は非同期バックエンドが担うため、専用決済ページには戻らない）
   サブステップ:
     1. JPYC EX ログイン / アカウント作成
     2. 初回は eKYC
     3. 接続事業者 callback 確認後、発行申請予約 API 実行
     4. JPYC EX に戻り、送金元銀行口座登録 / 振込先表示
   ============================================================ */

(function () {
  "use strict";

  // ---- クリックジャッキング対策 (G-2) ----
  // meta CSP では frame-ancestors を強制できないため、JS フォールバックで iframe 内表示を
  // 拒否する (sandbox で break-out 不能でも display:none で UI 重ねを無効化)。
  // 本番は HTTP ヘッダ (X-Frame-Options: DENY / CSP frame-ancestors 'none') を必須とする → /_headers
  if (self !== top) {
    try { document.documentElement.style.display = "none"; } catch (e) {}
    try { top.location = self.location; } catch (e) {}
  }

  // ---- Trusted Types (XSS sink の単一チョークポイント / R-3) ----
  // CSP の require-trusted-types-for 'script' 下では全 innerHTML 代入が TrustedHTML を
  // 要求する。"default" ポリシーを 1 つ置くことで全シンクを自動的に本ポリシー経由にし
  // (呼び出し側の改変不要・取りこぼし無し)、注入された <script>/イベントハンドラ属性を
  // バックストップ除去する (本文値は C1 で esc 済み)。非対応ブラウザは文字列のまま。
  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    try {
      window.trustedTypes.createPolicy("default", {
        // 危険な要素タグと、空白/スラッシュ区切りのイベントハンドラ属性を中和。
        // 区切りに / を含めることで <img/onerror= 型のバックストップ回避を塞ぐ (G-1)。
        createHTML: (s) => String(s)
          .replace(/<\s*(\/?\s*(script|svg|math|iframe|object|embed|link|base)\b)/gi, "&lt;$1")
          .replace(/([\s/])on[a-z]+\s*=/gi, "$1data-x="),
        // 動的 script / scriptURL は本アプリで一切使わないため fail-closed (throw)。
        createScript: () => { throw new TypeError("TT: dynamic script forbidden"); },
        createScriptURL: () => { throw new TypeError("TT: dynamic scriptURL forbidden"); },
      });
    } catch (e) { /* default ポリシー既定義などは無視 */ }
  }

  const PROFILE_KEY = "jpyc-demo-profile-v2";
  const PAYLOAD_KEY = "jpyc-ex-payload";

  const $card = document.getElementById("exCard");
  const $progress = document.getElementById("exProgress");
  const $stepTag = document.getElementById("stepTag");

  // ---- 入力検証 / 信頼境界化 ----
  // URL クエリ・sessionStorage payload は信頼境界の外。allowlist に一致しない値は
  // 採用せず安全な既定値へフォールバックする (描画前にゴミ/注入文字列を排除)。
  // 注: recv_wallet の「権威」は本来サーバーが UserOp.sender から再導出すべき
  // (R-1/S-1, 法務マター)。本モックでは形式検証のみを行い、ブラウザ値を信用しない。
  const RE_RESERVATION = /^JE\d{8}[0-9A-F]{4}$/;
  const RE_WALLET = /^0x[0-9a-fA-F]{40}$/;
  const NETWORK_ALLOW = ["Polygon", "Ethereum", "Astar", "Shiden", "Gnosis"];
  const AMOUNT_MAX = 10000000;

  function validReservationId(v) {
    return typeof v === "string" && RE_RESERVATION.test(v) ? v : null;
  }
  function validWallet(v, fallback) {
    return typeof v === "string" && RE_WALLET.test(v) ? v : fallback;
  }
  function validAmount(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= AMOUNT_MAX ? n : fallback;
  }
  function validNetwork(v, fallback) {
    return NETWORK_ALLOW.includes(v) ? v : fallback;
  }

  const params = new URLSearchParams(location.search);
  const AMOUNT = validAmount(params.get("amount"), 1980);
  const NETWORK = validNetwork(params.get("network"), "Polygon");
  // 復路先（加盟店ECサイトへ直接戻る。設計 §3）。同一 origin 相対のみ許可。
  const RETURN_TO = (() => {
    const r = params.get("return_to") || "/demo";
    return r === "/demo" || /^[\w.-]+\.html$/.test(r) ? r : "/demo";
  })();
  // 加盟店突合用の payment_intent_id を中継（正規形のみ）。
  const RETURN_PID = (() => {
    const v = params.get("payment_intent_id") || "";
    return /^pi_[0-9a-f]{12}$/.test(v) ? v : "";
  })();
  // デモ用パスキーモードフラグを EC へ中継（"real" のみ許可）。
  const REAL_PASSKEY = params.get("passkey") === "real";
  function returnHref(query) {
    let q = query || "";
    if (REAL_PASSKEY) q += (q ? "&" : "?") + "passkey=real";
    return RETURN_TO + q;
  }

  // ---- リロード復路 ----
  // 振込先案内には戻るボタンを置かない（デモの最終画面として見せるため）。
  // 案内表示後にページを「再読み込み」したら EC サイト（カート画面）へ戻し、
  // 受付演出（?status=received）につなげる。
  // 注意: SHOWN_KEY は「直前にこのページで振込先案内を表示した」という印だが、
  // ユーザーが再読み込み以外の経路（「ECサイトに戻る」ボタン・ブラウザバック等）で
  // 離脱すると sessionStorage に残り、次の周回でパスキー直後に post-reservation で
  // 再訪した瞬間に誤発火してカートへ即バウンスしてしまう（＝パスキー後に最初の
  // ページへ戻る不具合）。そこで「実際のリロード時のみ」復路させ、それ以外の
  // 新規遷移では残留フラグを掃除して誤発火を防ぐ。
  const SHOWN_KEY = "jpyc-ex-shown";
  const navEntry = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0]) || null;
  const isReload = navEntry
    ? navEntry.type === "reload"
    : !!(performance.navigation && performance.navigation.type === 1);
  let shownOnce = false;
  try { shownOnce = !!sessionStorage.getItem(SHOWN_KEY); } catch (e) {}
  if (shownOnce && isReload) {
    try { sessionStorage.removeItem(SHOWN_KEY); } catch (e) {}
    location.replace(returnHref("?status=received" + (RETURN_PID ? "&payment_intent_id=" + RETURN_PID : "")));
    return; // 復路遷移中は描画しない
  }
  // 再読み込み以外（新規遷移）でここに来た場合は、前周回で残ったフラグを掃除して
  // パスキー直後の誤バウンスを防ぐ。
  if (!isReload) { try { sessionStorage.removeItem(SHOWN_KEY); } catch (e) {} }

  const yen = (n) =>
    "¥" + Number(n).toLocaleString("ja-JP", { maximumFractionDigits: 2 });

  function randBytes(n) {
    const a = new Uint8Array(n);
    window.crypto.getRandomValues(a);
    return a;
  }
  // ---- 出力エンコーディング (XSS 一次防御) ----
  // innerHTML テンプレートに差し込む全ての動的値 (URL クエリ / sessionStorage
  // payload / localStorage profile 由来) は、HTML 本文・属性値の両コンテキストで
  // 安全になるよう必ず esc() を通す。escape 対象: & < > " '
  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---- profile (read existing) ----
  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) { return {}; }
  }
  const profile = loadProfile();
  const MODE = params.get("mode") === "post-reservation" ? "post-reservation" : "auth";

  // ---- payload (from agency reservation API) ----
  function loadPayload() {
    try {
      const raw = sessionStorage.getItem(PAYLOAD_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (e) { return {}; }
  }
  const payload = loadPayload();

  // ---- profile persistence（リピーターフロー: 完了ステップを localStorage に保持）----
  // 旧 app.js の saveProfile/scrubProfileForStore を JPYC EX 側へ移設。読み取り側
  // (loadProfile) だけが残り書き込みが失われていた退行を復旧する。長さ上限＋口座番号
  // マスクで localStorage への過剰保存を抑える。localStorage 不可時はフローを止めない。
  function scrubStr(s, max) {
    if (typeof s !== "string") return s;
    return s.replace(/[<>]/g, "").replace(/[\x00-\x1F\x7F]/g, "").slice(0, max);
  }
  function maskAccount(s) {
    if (typeof s !== "string" || s.length <= 4) return s;
    return "*".repeat(s.length - 4) + s.slice(-4);
  }
  function saveProfile() {
    try {
      const account = (result.jpycExAccount && result.jpycExAccount.email)
        ? {
            email: scrubStr(result.jpycExAccount.email, 254),
            loginMethod: LOGIN_METHOD_ALLOW.includes(result.jpycExAccount.loginMethod)
              ? result.jpycExAccount.loginMethod : "passkey",
          }
        : (result.jpycExAccount || null);
      const bankInfo = result.bankInfo ? {
        bank: scrubStr(result.bankInfo.bank, 40),
        branch: scrubStr(result.bankInfo.branch, 40),
        type: result.bankInfo.type === "当座" ? "当座" : "普通",
        accountNumber: maskAccount(scrubStr(result.bankInfo.accountNumber, 20)),
        holder: scrubStr(result.bankInfo.holder, 60),
      } : null;
      localStorage.setItem(PROFILE_KEY, JSON.stringify({
        jpycExAccount: account,
        kycCompleted: !!result.kycCompleted,
        bankRegistered: !!result.bankRegistered,
        bankInfo: bankInfo,
      }));
    } catch (e) { /* localStorage 不可時は永続化なし（フロー自体は継続） */ }
  }

  function payReturnHref() {
    const q = new URLSearchParams({
      payment_intent_id: RETURN_PID,
      return_url: RETURN_TO,
      jpyc_ex_auth: "pending",
    });
    if (REAL_PASSKEY) q.set("passkey", "real");
    return "pay.html?" + q.toString();
  }
  function storeAuthCallbackMock() {
    try {
      sessionStorage.setItem("jpyc-ex-auth-callback:" + RETURN_PID, JSON.stringify({
        status: "received",
        verified: true,
        accessTokenIssued: true,
        issuedAt: new Date().toISOString(),
      }));
    } catch (e) {}
  }

  // ---- sub-steps ----
  const SUB_STEPS = MODE === "post-reservation"
    ? [
        { id: "kyc", label: "本人確認 (Liquid)", firstTimeOnly: true, done: !!profile.kycCompleted },
        { id: "bank", label: "送金元銀行口座を登録", firstTimeOnly: true, done: !!profile.bankRegistered },
        { id: "transfer-info", label: "振込先情報", firstTimeOnly: false, done: false },
      ]
    : (profile.jpycExAccount
        ? [{ id: "auth", label: "JPYC EX ログイン認証", firstTimeOnly: false, done: false }]
        : [
            { id: "signup", label: "アカウント作成", firstTimeOnly: true, done: false },
            { id: "kyc", label: "本人確認 (Liquid)", firstTimeOnly: true, done: !!profile.kycCompleted },
            { id: "bank", label: "送金元銀行口座を登録", firstTimeOnly: true, done: !!profile.bankRegistered },
          ]);

  function nextRequired(fromIdx) {
    for (let i = fromIdx; i < SUB_STEPS.length; i++) {
      if (!(SUB_STEPS[i].firstTimeOnly && SUB_STEPS[i].done)) return i;
    }
    return SUB_STEPS.length - 1;
  }

  const result = {
    jpycExAccount: profile.jpycExAccount || null,
    jpycExAuthenticated: false,
    kycCompleted: !!profile.kycCompleted,
    bankRegistered: !!profile.bankRegistered,
    bankInfo: profile.bankInfo || null,
    reservationId: validReservationId(payload.reservationId) || null,
    reservedBank: payload.reservedBank || null,
    virtualNamekey: payload.virtualNamekey || null,
  };

  let currentIdx = nextRequired(0);

  // ---- アカウント作成のログイン方式選択 ----
  const LOGIN_METHOD_ALLOW = ["passkey", "sms", "voice"];
  let signupMethod = LOGIN_METHOD_ALLOW.includes(profile.jpycExAccount && profile.jpycExAccount.loginMethod)
    ? profile.jpycExAccount.loginMethod : "passkey";
  let signupEmail = "";

  // 偽 Touch ID ダイアログ（決済サイト pay.js と同一のモック）。パスキー方式の
  // アカウント作成時に「登録する」ラベルで表示する。resolve(true/false)。
  function runMockPasskey() {
    const $dlg = document.getElementById("passkeyDialog");
    const $ok = document.getElementById("passkeyConfirm");
    const $cancel = document.getElementById("passkeyCancel");
    if (!$dlg || !$ok || !$cancel) return Promise.resolve(true);
    const $title = document.getElementById("passkeyTitle");
    const $desc = document.getElementById("passkeyDesc");
    if ($title) $title.textContent = "パスワードなしでログイン";
    if ($desc) $desc.textContent = "パスキーというパスワードに代わる簡単で安全な\nログイン手段を使ってログインします";
    $ok.textContent = "登録する";
    return new Promise((resolve) => {
      let done = false;
      const close = (ok) => {
        if (done) return; done = true;
        $dlg.classList.remove("open");
        $ok.removeEventListener("click", onOk);
        $cancel.removeEventListener("click", onCancel);
        resolve(ok);
      };
      const onOk = () => close(true);
      const onCancel = () => close(false);
      $ok.addEventListener("click", onOk);
      $cancel.addEventListener("click", onCancel);
      $dlg.classList.add("open");
    });
  }

  function finalizeSignup() {
    result.jpycExAccount = { email: signupEmail || "yamada@example.com", loginMethod: signupMethod };
    SUB_STEPS[0].done = true;
    saveProfile();
    currentIdx = nextRequired(currentIdx + 1);
    render();
  }

  function renderProgress() {
    const total = SUB_STEPS.length;
    $progress.innerHTML = SUB_STEPS.map((s, i) => {
      let cls = "";
      const skipped = s.firstTimeOnly && s.done;
      if (i === currentIdx) cls = "active";
      else if (i < currentIdx || skipped) cls = "done";
      const tag = s.firstTimeOnly
        ? (skipped
            ? '<span class="step-tag skip">登録済</span>'
            : '<span class="step-tag once">初回のみ</span>')
        : "";
      return `<li class="${cls}"><span class="dot"></span><span class="step-label">${s.label}${tag}</span></li>`;
    }).join("");
    $stepTag.textContent = `ステップ ${currentIdx + 1} / ${total}`;
  }

  function viewAuth() {
    const returning = !!profile.jpycExAccount;
    const email = returning && profile.jpycExAccount.email ? profile.jpycExAccount.email : "yamada@example.com";
    $card.innerHTML = `
      <h1>JPYC EX ログイン認証</h1>

      <form id="authForm" class="ex-form">
        <div class="form-row">
          <label for="authEmail">メールアドレス</label>
          <input id="authEmail" type="email" required value="${esc(email)}" />
        </div>
        <div class="form-row">
          <label for="authPw">パスワード</label>
          <input id="authPw" type="password" required value="DemoPass123!" />
        </div>
      </form>
      <div class="ex-actions">
        <button type="button" class="btn btn-ghost" id="cancelBtn">キャンセル</button>
        <button type="button" class="btn ex-btn" id="authBtn">${returning ? "ログインする" : "認証を開始"}</button>
      </div>
    `;
    bindCommon();
    document.getElementById("authBtn").addEventListener("click", () => {
      result.jpycExAuthenticated = true;
      SUB_STEPS[0].done = true;
      if (returning) result.jpycExAccount = profile.jpycExAccount;
      storeAuthCallbackMock();
      location.href = payReturnHref();
    });
  }

  function viewSignup() {
    const m = signupMethod;
    const pwFields = (m === "sms" || m === "voice");
    const methodCard = (val, label, sub) => `
      <label class="login-method${m === val ? " selected" : ""}">
        <input type="radio" name="loginMethod" value="${val}"${m === val ? " checked" : ""} />
        <span class="login-method-body">
          <span class="login-method-title">${esc(label)}</span>
          <span class="login-method-sub">${esc(sub)}</span>
        </span>
      </label>`;
    const submitLabel = m === "passkey"
      ? "パスキーを登録してアカウント作成"
      : m === "sms" ? "SMSに認証コードを送信" : "音声通話で認証する";
    $card.innerHTML = `
      <h1>JPYC EX アカウント作成</h1>
      <p class="ex-sub">JPYC を発行・管理するための JPYC EX アカウントを作成します。ログイン方式を選んでください。</p>

      <div class="login-methods" role="radiogroup" aria-label="ログイン方式">
        ${methodCard("passkey", "パスキーによるログイン", "顔・指紋でログイン（推奨）")}
        ${methodCard("sms", "ID・パスワード＋SMS認証", "携帯電話番号に SMS で認証コードを送信")}
        ${methodCard("voice", "ID・パスワード＋音声着信認証", "自動音声の電話で認証コードを案内")}
      </div>

      <form id="signupForm" class="ex-form">
        <div class="form-row">
          <label for="email">メールアドレス</label>
          <input id="email" type="email" required value="yamada@example.com" />
        </div>
        ${pwFields ? `
        <div class="form-row">
          <label for="pw">パスワード</label>
          <input id="pw" type="password" required value="DemoPass123!" />
        </div>
        <div class="form-row">
          <label for="pw2">パスワード (確認)</label>
          <input id="pw2" type="password" required value="DemoPass123!" />
        </div>
        <div class="form-row">
          <label for="phone">携帯電話番号</label>
          <input id="phone" type="tel" inputmode="numeric" required value="090-1234-5678" />
        </div>
        ` : `
        <div class="callout">
          <span aria-hidden="true">ⓘ</span>
          この端末にパスキーを登録します。パスワードは不要です。
        </div>
        `}
        <div class="form-row">
          <label></label>
          <label class="check-line">
            <input type="checkbox" checked /> 利用規約・プライバシーポリシーに同意する
          </label>
        </div>
      </form>

      <div class="ex-actions">
        <button type="button" class="btn btn-ghost" id="cancelBtn">キャンセル</button>
        <button type="button" class="btn ex-btn" id="signupBtn">${esc(submitLabel)}</button>
      </div>
    `;
    bindCommon();
    // ログイン方式の切替でフォームを再描画する。
    $card.querySelectorAll('input[name="loginMethod"]').forEach((r) => {
      r.addEventListener("change", () => { signupMethod = r.value; viewSignup(); });
    });
    document.getElementById("signupBtn").addEventListener("click", () => {
      signupEmail = document.getElementById("email").value || "yamada@example.com";
      if (signupMethod === "passkey") {
        // 決済サイトと同一のパスキーモーダル。承認でアカウント作成、キャンセルで留まる。
        runMockPasskey().then((ok) => { if (ok) finalizeSignup(); });
      } else {
        viewSignupCode(signupMethod);
      }
    });
  }

  // SMS / 音声着信のコード入力（デモ簡易シミュレート・両方式で共用）
  function viewSignupCode(method) {
    const channel = method === "sms" ? "SMS" : "自動音声通話";
    const sent = method === "sms"
      ? "ご登録の携帯電話番号に SMS で認証コードを送信しました。"
      : "ご登録の携帯電話番号に自動音声でお電話します。案内される認証コードを入力してください。";
    $card.innerHTML = `
      <h1>JPYC EX アカウント作成</h1>
      <p class="ex-sub">${esc(channel)}による認証</p>
      <div class="callout"><span aria-hidden="true">ⓘ</span>${esc(sent)}</div>
      <form id="codeForm" class="ex-form">
        <div class="form-row">
          <label for="authCode">認証コード（6桁）</label>
          <input id="authCode" type="text" inputmode="numeric" maxlength="6" required value="123456" />
        </div>
      </form>
      <div class="ex-actions">
        <button type="button" class="btn btn-ghost" id="codeBack">戻る</button>
        <button type="button" class="btn ex-btn" id="codeBtn">認証してアカウント作成</button>
      </div>
    `;
    bindCommon();
    document.getElementById("codeBack").addEventListener("click", () => { viewSignup(); });
    document.getElementById("codeBtn").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      btn.setAttribute("disabled", "true");
      btn.innerHTML = '<span class="spinner"></span> 認証中…';
      setTimeout(finalizeSignup, 800);
    });
  }

  function viewKyc() {
    $card.innerHTML = `
      <h1>本人確認 (eKYC)</h1>
      <p class="ex-sub">本人確認は <strong>Liquid</strong> スマートフォンアプリを使い、<strong>マイナンバーカード</strong>の読み取りで行います。</p>

      <div class="kyc-pair">
        <div class="kyc-phone-mock">
          <div class="phone-frame">
            <div class="phone-screen">
              <div class="phone-bar"><span class="phone-bar-dot"></span>Liquid</div>
              <div class="phone-content">
                <div class="phone-card-icon" aria-hidden="true">
                  <div class="phone-card">
                    <div class="phone-card-strip"></div>
                    <div class="phone-card-chip"></div>
                  </div>
                </div>
                <div class="phone-status" id="phoneStatus">スマートフォンで Liquid アプリを起動し、マイナンバーカードを読み取ってください</div>
              </div>
            </div>
          </div>
        </div>
        <div class="kyc-instructions">
          <ol class="kyc-steps">
            <li>スマートフォンの <strong>Liquid</strong> アプリを起動</li>
            <li>表示された QR コードを Liquid アプリで読み取る</li>
            <li>マイナンバーカードを背面 IC リーダーにかざす</li>
            <li>暗証番号 (4桁) を入力して読み取りを完了</li>
          </ol>
          <div class="qr-box" id="qrBox">
            <div class="qr-mock" aria-hidden="true"></div>
            <div class="qr-caption">demo: クリックすると Liquid 完了をシミュレート</div>
          </div>
        </div>
      </div>

      <div class="ex-actions">
        <button class="btn btn-ghost" id="kycBack">戻る</button>
        <button class="btn ex-btn" id="kycSim">スマホで本人確認を完了 (デモ)</button>
      </div>
    `;
    bindCommon();
    document.getElementById("kycBack").addEventListener("click", () => {
      for (let i = currentIdx - 1; i >= 0; i--) {
        if (!(SUB_STEPS[i].firstTimeOnly && SUB_STEPS[i].done)) {
          currentIdx = i;
          render();
          return;
        }
      }
    });
    document.getElementById("qrBox").addEventListener("click", simulateLiquid);
    document.getElementById("kycSim").addEventListener("click", simulateLiquid);

    function simulateLiquid() {
      const ps = document.getElementById("phoneStatus");
      const btn = document.getElementById("kycSim");
      const back = document.getElementById("kycBack");
      btn.setAttribute("disabled", "true");
      back.setAttribute("disabled", "true");
      btn.innerHTML = '<span class="spinner"></span> 読み取り中…';
      ps.textContent = "マイナンバーカードを読み取っています…";
      setTimeout(() => {
        ps.innerHTML = '<span class="ok-mark">✓</span> 本人確認が完了しました';
        document.querySelector(".phone-screen").classList.add("ok");
        setTimeout(() => {
          result.kycCompleted = true;
          SUB_STEPS[currentIdx].done = true;
          saveProfile();
          currentIdx = nextRequired(currentIdx + 1);
          render();
        }, 800);
      }, 1500);
    }
  }

  function viewBank() {
    const b = result.bankInfo || {};
    const v = (k, d) => (b[k] !== undefined && b[k] !== null && b[k] !== "") ? b[k] : d;
    $card.innerHTML = `
      <h1>送金元銀行口座の登録</h1>
      <p class="ex-sub">JPYC EX に振込元となるあなたの銀行口座を登録します。登録した口座以外からの振込は受け付けられません。</p>

      <form id="bankForm" class="ex-form">
        <div class="form-row">
          <label for="bankName">銀行名</label>
          <select id="bankName" required>
            ${["みずほ銀行","三菱UFJ銀行","三井住友銀行","ゆうちょ銀行","楽天銀行"]
              .map((n) => `<option ${v("bank","みずほ銀行")===n?"selected":""}>${n}</option>`).join("")}
          </select>
        </div>
        <div class="form-row">
          <label for="branch">支店名</label>
          <input id="branch" type="text" value="${esc(v("branch","渋谷支店"))}" />
        </div>
        <div class="form-row">
          <label for="acctType">口座種別</label>
          <select id="acctType">
            <option ${v("type","普通")==="普通"?"selected":""}>普通</option>
            <option ${v("type","普通")==="当座"?"selected":""}>当座</option>
          </select>
        </div>
        <div class="form-row">
          <label for="acctNumber">口座番号</label>
          <input id="acctNumber" type="text" inputmode="numeric" value="${esc(v("accountNumber","1234567"))}" />
        </div>
        <div class="form-row">
          <label for="acctHolder">名義 (カナ)</label>
          <input id="acctHolder" type="text" value="${esc(v("holder","ヤマダ タロウ"))}" />
        </div>
      </form>

      <div class="callout">
        <span aria-hidden="true">ⓘ</span>
        この情報は JPYC EX が保管します。
      </div>

      <div class="ex-actions">
        <button type="button" class="btn btn-ghost" id="bankBack">戻る</button>
        <button type="button" class="btn ex-btn" id="bankBtn">登録する</button>
      </div>
    `;
    bindCommon();
    document.getElementById("bankBack").addEventListener("click", () => {
      for (let i = currentIdx - 1; i >= 0; i--) {
        if (!(SUB_STEPS[i].firstTimeOnly && SUB_STEPS[i].done)) {
          currentIdx = i;
          render();
          return;
        }
      }
    });
    document.getElementById("bankBtn").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      btn.setAttribute("disabled", "true");
      btn.innerHTML = '<span class="spinner"></span> 登録中…';
      result.bankInfo = {
        bank: document.getElementById("bankName").value,
        branch: document.getElementById("branch").value,
        type: document.getElementById("acctType").value,
        accountNumber: document.getElementById("acctNumber").value,
        holder: document.getElementById("acctHolder").value,
      };
      result.bankRegistered = true;
      SUB_STEPS[currentIdx].done = true;
      saveProfile();
      setTimeout(() => {
        if (MODE === "auth") {
          storeAuthCallbackMock();
          location.href = payReturnHref();
          return;
        }
        currentIdx = nextRequired(currentIdx + 1);
        render();
      }, 900);
    });
  }

  function viewTransferInfo() {
    const r = result.reservedBank;
    if (!r) {
      $card.innerHTML = `
        <h1>振込先情報を読み込めませんでした</h1>
        <p class="ex-sub">EC サイトからお戻りいただき、もう一度お試しください。</p>
        <div class="ex-actions end">
          <button class="btn ex-btn" id="returnEC">ECサイトに戻る</button>
        </div>
      `;
      document.getElementById("returnEC").addEventListener("click", () => {
        location.href = returnHref("");
      });
      return;
    }
    const holder = (result.bankInfo && result.bankInfo.holder) || "ヤマダ タロウ";
    const namekey = result.virtualNamekey;
    $card.innerHTML = `
      <h1>振込先のご案内</h1>
      <p class="ex-sub">以下の口座へお振込みください。振込確認後、JPYC が発行され、<strong>お客様ご自身のお支払い用アカウントに直接届きます</strong>。</p>

      <div class="transfer-amount">
        <span class="k">お振込みいただく金額</span>
        <span class="v">${yen(AMOUNT)}</span>
      </div>

      <div class="reservation-pending">
        <span class="pending-dot ok"></span>
        振込予約 ${esc(result.reservationId)} 受領済み (${esc(NETWORK)} / お客様ご自身のお支払い用アカウント / ${yen(AMOUNT)})
      </div>

      <div class="bank-details secure">
        <h4>振込先口座</h4>
        <div class="bank-row">
          <span class="k">銀行名</span>
          <span class="v">${esc(r.bank)}</span>
          <button type="button" class="btn-copy" data-copy="${esc(r.bank)}">コピー</button>
        </div>
        <div class="bank-row">
          <span class="k">支店</span>
          <span class="v">${esc(r.branch)}</span>
          <button type="button" class="btn-copy" data-copy="${esc(r.branch)}">コピー</button>
        </div>
        <div class="bank-row"><span class="k">口座種別</span><span class="v">${esc(r.type)}</span><span></span></div>
        <div class="bank-row">
          <span class="k">口座番号</span>
          <span class="v">${esc(r.account)}</span>
          <button type="button" class="btn-copy" data-copy="${esc(r.account)}">コピー</button>
        </div>
        <div class="bank-row">
          <span class="k">口座名義</span>
          <span class="v">${esc(r.holder)}</span>
          <button type="button" class="btn-copy" data-copy="${esc(r.holder)}">コピー</button>
        </div>
        <div class="bank-row">
          <span class="k">振込金額</span>
          <span class="v">${yen(AMOUNT)}</span>
          <button type="button" class="btn-copy" data-copy="${esc(AMOUNT)}">コピー</button>
        </div>
        <div class="bank-row">
          <span class="k">振込人名義</span>
          <span class="v">${esc(holder)} (${esc(namekey)})</span>
          <button type="button" class="btn-copy" data-copy="${esc(holder)} (${esc(namekey)})">コピー</button>
        </div>
      </div>

      <div class="callout warn">
        <span aria-hidden="true">⚠</span>
        <div>
          振込人名義の末尾に必ず照合キー <strong>(${esc(namekey)})</strong> を付けてお振込みください。JPYC EX があなたの振込を識別します。
        </div>
      </div>

      <p class="muted reload-hint">（デモ）この画面を再読み込みすると EC サイトのカート画面に戻ります。</p>
    `;
    bindCommon();
    try { sessionStorage.setItem(SHOWN_KEY, "1"); } catch (e) {}
    // 振込ページ到達の2秒後に案内ポップアップを表示（読了後は自身でタップして閉じる）
    setTimeout(showTransferNotice, 2000);
    document.querySelectorAll("[data-copy]").forEach((el) => {
      el.addEventListener("click", () => {
        const text = el.getAttribute("data-copy");
        if (navigator.clipboard) navigator.clipboard.writeText(text);
        el.classList.add("copied");
        const orig = el.textContent;
        el.textContent = "コピー完了";
        setTimeout(() => { el.classList.remove("copied"); el.textContent = orig; }, 1200);
      });
    });
  }

  function bindCommon() {
    // インライン onsubmit を廃した代替 (strict CSP 下でのフォーム reload 防止)
    $card.querySelectorAll("form").forEach((f) => {
      f.addEventListener("submit", (e) => e.preventDefault());
    });
    const cancel = document.getElementById("cancelBtn");
    if (cancel) {
      cancel.addEventListener("click", () => { location.href = returnHref(""); });
    }
  }

  // 振込先案内に到達した後の案内ポップアップ。確認ボタンは設けず、
  // 背景タップで閉じられるようにする（最終画面のため自動遷移はしない）。
  function showTransferNotice() {
    const $dlg = document.getElementById("transferNoticeDialog");
    if (!$dlg || $dlg.classList.contains("open")) return;
    $dlg.classList.add("open");
    $dlg.addEventListener("click", () => $dlg.classList.remove("open"), { once: true });
  }

  function render() {
    renderProgress();
    const id = SUB_STEPS[currentIdx].id;
    switch (id) {
      case "signup":        return viewSignup();
      case "kyc":           return viewKyc();
      case "bank":          return viewBank();
      case "auth":          return viewAuth();
      case "transfer-info": return viewTransferInfo();
    }
  }

  render();
})();
