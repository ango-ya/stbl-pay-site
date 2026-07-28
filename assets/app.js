/* ============================================================
   すてぶるペイ デモ — 加盟店ページ（カート起点版）
   責務: 商品表示 / カート（追加・数量変更・削除） /
        [すてぶるペイで支払う] で payment_intent 発行 → 専用決済ページへ遷移 /
        決済後の ?status=received/paid（受付→確定）結果表示。
   決済の内容確認・パスキーは専用決済ページ pay.html が担う（設計 §3）。
   ============================================================ */
(function () {
  "use strict";

  // ---- クリックジャッキング対策（meta CSP では frame-ancestors を強制できないため）----
  if (self !== top) {
    try { document.documentElement.style.display = "none"; } catch (e) {}
    try { top.location = self.location; } catch (e) {}
  }

  // ---- Trusted Types（XSS sink の単一チョークポイント）----
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

  const DEMO_PATH = "/demo";
  function normalizeDemoUrl(keepQuery) {
    const suffix = keepQuery ? location.search : "";
    const hash = keepQuery ? location.hash : "";
    const next = DEMO_PATH + suffix + hash;
    if (location.pathname !== DEMO_PATH || location.search !== suffix || location.hash !== hash) {
      history.replaceState({}, "", next);
    }
  }
  if (location.pathname === "/demo.html" || location.pathname === "/demo/") {
    normalizeDemoUrl(true);
  }

  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  const yen = (n) => "¥" + Number(n).toLocaleString("ja-JP");

  // ---- 商品カタログ（単価の権威は intent に移すため、ここは「intent 生成の素」）----
  const MERCHANT = "kurashi mart";
  const RECV_HINT = "加盟店の受取先";
  // デジタルコンテンツのみ（配送なし・ダウンロード提供）
  const PRODUCTS = {
    ebook:  { name: "コーヒー抽出パーフェクトガイド（電子書籍）", price: 1480 },
    video:  { name: "ハンドドリップ実践講座（動画コース）", price: 2980 },
    preset: { name: "カフェ風写真プリセット集（素材データ）", price: 980 },
  };

  // ---- カート（sessionStorage 永続。信頼境界の内側では扱わない: 金額は intent 発行時に
  //      カタログから再計算し、pay.html 側でも整合性を再検証する）----
  // デモの初期表示は「カートに商品が入っている」状態から始める（カート起点フローを即座に見せる）。
  // ユーザーが空にした状態はリロードしても維持し、デモリセットで初期状態へ戻る。
  const CART_KEY = "cart-v1";
  const DEFAULT_CART = [
    { sku: "ebook", qty: 1 },
    { sku: "video", qty: 1 },
    { sku: "preset", qty: 1 },
  ];
  function defaultCart() {
    return DEFAULT_CART.map((l) => ({ sku: l.sku, qty: l.qty }));
  }
  function loadCart() {
    try {
      const raw = sessionStorage.getItem(CART_KEY);
      if (raw === null) return defaultCart(); // 未初期化（初回表示）のみ既定カート
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return defaultCart();
      return arr
        .filter((l) => l && PRODUCTS[l.sku])
        .map((l) => ({ sku: l.sku, qty: Math.min(99, Math.max(1, Number(l.qty) || 1)) }))
        .slice(0, 10);
    } catch (e) { return defaultCart(); }
  }
  function saveCart() {
    try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {}
  }
  let cart = loadCart();

  function cartTotal() {
    return cart.reduce((sum, l) => sum + PRODUCTS[l.sku].price * l.qty, 0);
  }
  function cartCount() {
    return cart.reduce((sum, l) => sum + l.qty, 0);
  }
  // 注文完了後は既定カートへ戻す（デモは繰り返し実施するため、次の周回をすぐ始められる状態にする）
  function resetCartToDefault() {
    cart = defaultCart();
    saveCart();
    renderCart();
  }

  // ---- カート描画 ----
  const $cartItems = document.getElementById("cartItems");
  const $sumTotal = document.getElementById("sumTotal");
  const $headerCount = document.getElementById("cartCount");
  const $payBtn = document.getElementById("openJpyc");

  // すてぶるペイの最低お支払い金額（JPYC の利用制限に対応）
  const MIN_AMOUNT = 3000;

  function renderCart() {
    if ($cartItems) {
      if (cart.length === 0) {
        $cartItems.innerHTML = '<p class="cart-empty" id="cartEmpty">カートは空です。商品を追加してください。</p>';
      } else {
        $cartItems.innerHTML = cart.map((l) => {
          const p = PRODUCTS[l.sku];
          return `
            <div class="cart-row" data-sku="${esc(l.sku)}">
              <img class="cart-thumb" src="/assets/img/${esc(l.sku)}.jpg" alt="" />
              <div class="cart-name">${esc(p.name)}<span class="cart-unit">${yen(p.price)}</span></div>
              <div class="qty-control">
                <button type="button" class="cart-minus" aria-label="${esc(p.name)} を減らす">−</button>
                <span class="num">${l.qty}</span>
                <button type="button" class="cart-plus" aria-label="${esc(p.name)} を増やす">＋</button>
              </div>
              <div class="cart-line-total">${yen(p.price * l.qty)}</div>
              <button type="button" class="cart-remove" aria-label="${esc(p.name)} を削除">削除</button>
            </div>`;
        }).join("");
      }
    }
    const total = cartTotal();
    if ($sumTotal) $sumTotal.textContent = yen(total);
    if ($headerCount) $headerCount.textContent = String(cartCount());
    if ($payBtn) $payBtn.disabled = cart.length === 0 || total < MIN_AMOUNT;
    const $minNote = document.getElementById("minPayNote");
    if ($minNote) $minNote.hidden = !(cart.length > 0 && total < MIN_AMOUNT);
    bindCartRows();
  }

  function bindCartRows() {
    if (!$cartItems) return;
    $cartItems.querySelectorAll(".cart-row").forEach(($row) => {
      const sku = $row.getAttribute("data-sku");
      const line = cart.find((l) => l.sku === sku);
      if (!line) return;
      const $minus = $row.querySelector(".cart-minus");
      const $plus = $row.querySelector(".cart-plus");
      const $remove = $row.querySelector(".cart-remove");
      if ($minus) $minus.addEventListener("click", () => {
        line.qty = Math.max(1, line.qty - 1); saveCart(); renderCart();
      });
      if ($plus) $plus.addEventListener("click", () => {
        line.qty = Math.min(99, line.qty + 1); saveCart(); renderCart();
      });
      if ($remove) $remove.addEventListener("click", () => {
        cart = cart.filter((l) => l.sku !== sku); saveCart(); renderCart();
      });
    });
  }

  function randHex(len) {
    const a = new Uint8Array(Math.ceil(len / 2));
    window.crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, len);
  }

  // ---- intent 発行（金額・明細の権威は intent 側。URL には id のみ載せる）----
  function issueIntent() {
    const id = "pi_" + randHex(12);
    const items = cart.map((l) => ({
      sku: l.sku,
      name: PRODUCTS[l.sku].name,
      qty: l.qty,
      price: PRODUCTS[l.sku].price,
    }));
    const intent = {
      id,
      amount: cartTotal(),
      items,
      merchant: MERCHANT,
      recvHint: RECV_HINT,
      createdAt: Date.now(),
    };
    sessionStorage.setItem("intent:" + id, JSON.stringify(intent));
    return id;
  }

  // ---- 初回/2回目バッジ（状態依存・案C）＋デモリセット ----
  function isReturning() {
    return !!(localStorage.getItem("pay-mock-enrolled") || localStorage.getItem("pay-cred-id"));
  }
  const $badge = document.getElementById("accountBadge");
  if ($badge) {
    if (isReturning()) {
      $badge.textContent = "登録済み・2回目以降";
      $badge.classList.remove("first"); $badge.classList.add("repeat");
    } else {
      $badge.textContent = "初回のお客様";
      $badge.classList.remove("repeat"); $badge.classList.add("first");
    }
  }
  const $reset = document.getElementById("resetDemo");
  if ($reset) {
    $reset.addEventListener("click", () => {
      ["pay-mock-enrolled", "pay-cred-id", "jpyc-demo-profile-v2"].forEach((k) => localStorage.removeItem(k));
      try { sessionStorage.removeItem(CART_KEY); } catch (e) {}
      location.reload();
    });
  }

  if ($payBtn) {
    $payBtn.addEventListener("click", () => {
      if (cart.length === 0 || cartTotal() < MIN_AMOUNT) return;
      const id = issueIntent();
      const returnUrl = encodeURIComponent("/demo");
      // 金額は URL に載せない（intent 側が権威）。専用決済ページへトップレベル遷移（FR-001a/b/e）。
      let url = "/pay.html?payment_intent_id=" + encodeURIComponent(id) + "&return_url=" + returnUrl;
      if (new URLSearchParams(location.search).get("passkey") === "real") url += "&passkey=real";
      location.href = url;
    });
  }

  // ---- 決済完了後の復帰（JPYC EX から ?status=received/paid で戻る）----
  // 受付・確定などの文言は表示せず、次のデモ周回に備えてカートを既定状態へ静かに戻すだけにする。
  const params = new URLSearchParams(location.search);
  const status = params.get("status");
  if (status === "received" || status === "paid") {
    resetCartToDefault();
    // クエリを消して通常のカート画面として表示する。デモ用の ?passkey=real だけはモード維持のため残す。
    history.replaceState({}, "", DEMO_PATH + (params.get("passkey") === "real" ? "?passkey=real" : ""));
  }

  // ---- ヘッダー elevation on scroll ----
  const $siteHeader = document.querySelector(".site-header");
  if ($siteHeader) {
    const onScroll = () => { $siteHeader.classList.toggle("is-scrolled", window.scrollY > 4); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---- boot ----
  renderCart();
})();
