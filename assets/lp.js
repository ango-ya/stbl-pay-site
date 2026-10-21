(function () {
  // 画面外セクションの描画の後回し（lp.css の content-visibility）を解く。
  // 後回しは最初の表示を速くするためのもので、そのままだとページ内リンクの飛び先がずれる。
  const root = document.documentElement;
  const release = () => root.classList.add("cv-ready");

  // #… 付きで開いたとき：すぐ解いて、目的の位置へ合わせ直す
  if (location.hash.length > 1) {
    release();
    // 不正な % を含む URL（途中で切れた共有 URL など）でも例外で止めない。デコードできなければそのまま使う
    let id = location.hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch (error) {
      // そのまま使う
    }
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView();
    }
  }

  // ページ内リンクを押したとき：飛ぶ前に解く（キャプチャで先に動く）
  document.addEventListener(
    "click",
    (event) => {
      if (event.target instanceof Element && event.target.closest('a[href^="#"]')) {
        release();
      }
    },
    true
  );

  // 読み込みが終わって手が空いたら解く
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  if (document.readyState === "complete") {
    idle(release, { timeout: 2000 });
  } else {
    window.addEventListener("load", () => idle(release, { timeout: 2000 }), { once: true });
  }
})();

(function () {
  // ヒーロー背景「フリップドット・ボード」（Canvas 2D・依存ゼロ・CSP/Trusted Types内）。
  // ロゴと同じ前傾角の平行四辺形セルを敷き詰めた機械式掲示板。
  // 明度は5段階に量子化（機械の実直さ）。ロゴのスリット模様と同じ斜めストライプ波が
  // 右から左へ掃引し、数秒に一度、盤面全体を大きなストライプパターンが走り抜ける。
  // - prefers-reduced-motion: 静止1フレームのみ
  // - Canvas非対応: .art-fallback（CSSグラデーションに委ねる）
  // - タブ非表示・ヒーロー画面外では描画停止
  const canvas = document.getElementById("hero-art");
  const hero = canvas ? canvas.closest(".hero") : null;

  if (!canvas || !hero) {
    return;
  }

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    hero.classList.add("art-fallback");
    return;
  }

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const GRID = 22;        // セルピッチ(px)
  const CELL_W = 12;
  const CELL_H = 12;
  const SHEAR = 4.4;      // 前傾（ロゴの斜体角に対応）
  const SLANT = 2.6;      // ストライプ波の傾き（dy/dxの逆比）
  const BURST_PERIOD = 9.0;
  const BURST_TRAVEL = 1.8;
  const COLORS = ["#12315c", "#1b4c8f", "#2775ca", "#63d9ff"]; // 量子化4段（+消灯）

  let W = 0;
  let H = 0;
  let cols = 0;
  let rowsN = 0;
  let phases = null;   // セルごとの固有位相（決定的ハッシュ）
  let cellPath = null;
  let ptrX = -1e4;
  let ptrY = -1e4;
  let ptrIn = false;

  const hash = (c, r) => {
    const v = Math.sin(c * 127.1 + r * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  const resize = () => {
    const w = Math.max(1, hero.clientWidth);
    const h = Math.max(1, hero.clientHeight);
    if (w === W && h === H) {
      return;
    }
    W = w;
    H = h;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    cols = Math.ceil(W / GRID) + 2;
    rowsN = Math.ceil(H / GRID) + 2;
    phases = new Float32Array(cols * rowsN);
    for (let r = 0; r < rowsN; r++) {
      for (let c = 0; c < cols; c++) {
        phases[r * cols + c] = hash(c, r) * Math.PI * 2;
      }
    }
    cellPath = new Path2D();
    cellPath.moveTo(SHEAR, 0);
    cellPath.lineTo(CELL_W + SHEAR, 0);
    cellPath.lineTo(CELL_W, CELL_H);
    cellPath.lineTo(0, CELL_H);
    cellPath.closePath();
  };

  const frame = (t) => {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 全面バースト: BURST_PERIODごとに右→左へストライプパターンが走る
    const bp = (t % BURST_PERIOD) / BURST_TRAVEL;
    const burstX = bp <= 1 ? W + 260 - (W + 620) * bp : -1e4;

    const cx = W * 0.5;
    const cy = H * 0.46;
    const rx = W * 0.37;
    const ry = H * 0.36;

    // 量子化バケツ（色ごとにまとめ描き）
    const buckets = [[], [], [], []];

    for (let r = 0; r < rowsN; r++) {
      const y = r * GRID - GRID * 0.5;
      for (let c = 0; c < cols; c++) {
        const x = c * GRID - GRID * 0.5;
        const d = x + y * 0 + (H - y) * SLANT; // 斜め座標（ロゴスリットと同角の帯）

        // 1) 斜めストライプ波（右→左に掃引）
        let v = 0.30 + 0.38 * Math.sin(d * 0.006 + t * 0.9);
        v += 0.16 * Math.sin(d * 0.016 + t * 1.7);

        // 2) セル固有のシマー（掲示板のチラつき）
        v += 0.10 * Math.sin(t * 1.1 + phases[r * cols + c]);

        // 3) バースト: 通過帯の中はロゴ状の太スリット模様が点灯
        if (burstX > -1e4) {
          const bd = (x - burstX) / 260;
          const env = Math.exp(-bd * bd);
          if (env > 0.02) {
            const stripe = ((d - burstX * 1.4) % 190 + 190) % 190 < 96 ? 1 : -0.4;
            v += env * stripe * 0.9;
          }
        }

        // 4) ポインター点灯
        if (ptrIn) {
          const dx = (x - ptrX) / 150;
          const dy2 = (y - ptrY) / 150;
          const g = Math.exp(-(dx * dx + dy2 * dy2));
          v += g * 0.85;
        }

        // 5) 中央の静穏ゾーン（コンテンツ可読性）
        const ex = (x - cx) / rx;
        const ey = (y - cy) / ry;
        const e2 = ex * ex + ey * ey;
        if (e2 < 1) {
          v *= 0.22 + 0.78 * e2;
        }

        // 量子化（0〜4段）: 機械式の離散状態
        const q = Math.round(Math.max(0, Math.min(1, v)) * 4);
        if (q > 0) {
          buckets[q - 1].push(x, y);
        }
      }
    }

    for (let b = 0; b < 4; b++) {
      const list = buckets[b];
      if (list.length === 0) {
        continue;
      }
      ctx.fillStyle = COLORS[b];
      for (let i = 0; i < list.length; i += 2) {
        ctx.setTransform(DPR, 0, 0, DPR, list[i] * DPR, list[i + 1] * DPR);
        ctx.fill(cellPath);
      }
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  };

  resize();

  // 登場はシンプルに: hero-inner をワンフェード
  hero.classList.add("hero-anim");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      hero.classList.add("hero-in");
    });
  });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    frame(3.6);
    window.addEventListener("resize", () => {
      resize();
      frame(3.6);
    });
    return;
  }

  hero.addEventListener(
    "pointermove",
    (e) => {
      const r = hero.getBoundingClientRect();
      ptrX = e.clientX - r.left;
      ptrY = e.clientY - r.top;
      ptrIn = true;
    },
    { passive: true }
  );

  hero.addEventListener("pointerleave", () => {
    ptrIn = false;
  });

  let running = true;
  let inView = true;
  const start = performance.now();

  const loop = (now) => {
    if (running && inView && !document.hidden) {
      frame((now - start) / 1000);
    }
    requestAnimationFrame(loop);
  };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        inView = entry.isIntersecting;
      });
    }).observe(hero);
  }

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
  });

  window.addEventListener("resize", resize);
  requestAnimationFrame(loop);
})();

(function () {
  // 先行案内（リード獲得）フォームの送信処理。
  // 送信先は index.html の <form data-early-form data-endpoint="..."> から読む。
  // data-endpoint が空（属性なし含む）のときは実送信せず、誠実なフォールバックを表示する。
  // 接続手順は README / NOTES 参照（推奨は同一オリジンの Cloudflare Pages Functions）。
  // フォーム文言の言語辞書。<html lang="en"> のときだけ英語、それ以外は日本語（既定）。
  // 日本語文言は従来のリテラルをそのまま移設したもの（変更禁止）。
  const FORM_MESSAGES = {
    ja: {
      company: "会社名をご記入ください。",
      contact: "担当者名をご記入ください。",
      email: "メールアドレスをご確認ください。",
      message: "お問い合わせ内容をご記入ください。",
      fallback:
        "ありがとうございます。お問い合わせは、運営会社（暗号屋）のサイト https://www.ango-ya.org/ からもお受けしています。",
      sending: "送信中…",
      success: "ありがとうございます。お問い合わせを受け付けました。",
      failure: "送信に失敗しました。時間をおいて再度お試しください。",
    },
    en: {
      company: "Please enter your company name.",
      contact: "Please enter a contact name.",
      email: "Please check your email address.",
      message: "Please enter your message.",
      fallback:
        "Thank you. You can also reach us via the operator's (Ango-ya) website: https://www.ango-ya.org/",
      sending: "Sending…",
      success: "Thank you. We've received your inquiry.",
      failure: "Something went wrong. Please try again in a moment.",
    },
  };
  const MSG =
    document.documentElement.lang === "en" ? FORM_MESSAGES.en : FORM_MESSAGES.ja;
  const form = document.querySelector("[data-early-form]");
  const state = document.querySelector("[data-early-state]");

  if (!form || !state) {
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  const submitText = submit ? submit.textContent : "";
  let sending = false;
  const track = (name, params) => {
    document.dispatchEvent(new CustomEvent("stblpay:analytics", {
      detail: { name, params },
    }));
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (sending) {
      return;
    }

    const email = form.querySelector('input[name="email"]');
    const company = form.querySelector('input[name="company"]');
    const contact = form.querySelector('input[name="contact"]');
    const message = form.querySelector('[name="message"]');
    const website = form.querySelector('input[name="website"]'); // honeypot
    const endpoint = (form.getAttribute("data-endpoint") || "").trim();
    const value = ((email && email.value) || "").trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    if (!(company && company.value.trim())) {
      state.textContent = MSG.company;
      if (company) company.focus();
      return;
    }

    if (!(contact && contact.value.trim())) {
      state.textContent = MSG.contact;
      if (contact) contact.focus();
      return;
    }

    if (!valid) {
      state.textContent = MSG.email;
      if (email) email.focus();
      return;
    }

    if (!(message && message.value.trim())) {
      state.textContent = MSG.message;
      if (message) message.focus();
      return;
    }

    if (!endpoint) {
      // 送信先未接続時のフォールバック。実際の保存・送信はしない。
      state.textContent = MSG.fallback;
      track("form_submit", {
        form_id: "early-access",
        endpoint_connected: false,
        source: "lp-early-access",
      });
      form.reset();
      return;
    }

    sending = true;
    state.textContent = MSG.sending;
    if (submit) {
      submit.disabled = true;
      submit.textContent = MSG.sending;
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          email: value,
          company: (company && company.value) || "",
          contact: (contact && contact.value) || "",
          message: (message && message.value) || "",
          website: (website && website.value) || "",
          source: "lp-early-access",
        }),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }

      state.textContent = MSG.success;
      track("form_submit", {
        form_id: "early-access",
        endpoint_connected: true,
        source: "lp-early-access",
      });
      form.reset();
    } catch (error) {
      state.textContent = MSG.failure;
      track("form_submit_failed", {
        form_id: "early-access",
        endpoint_connected: true,
        source: "lp-early-access",
      });
    } finally {
      sending = false;
      if (submit) {
        submit.disabled = false;
        submit.textContent = submitText;
      }
    }
  });
})();

(function () {
  // スクロールリビール（フェードアップ＋グリッド内スタッガー）。
  // 目的: 視線誘導。reduced-motion・IntersectionObserver非対応環境では何もしない
  // （.reveal を付けないので常時表示のまま）。
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  if (!("IntersectionObserver" in window)) {
    return;
  }

  const targets = [];

  // 単体要素: 見出し・リード文・補足・パネル類
  document
    .querySelectorAll(
      ".section h2, .sec-lead, .stats-lead, .flow-note, .note, .table-wrap, .roi-panel, .early-form, .early-mail, .talk, .cast, .video-stage, .video-links, .video-foot"
    )
    .forEach((el) => {
      el.classList.add("reveal");
      targets.push(el);
    });

  // グリッド: 親ごとに 60ms 刻みのスタッガー（上限 300ms — 待たせすぎない）
  document.querySelectorAll(".stats-grid, .flow, .audience, .value-grid, .video-list").forEach((group) => {
    Array.prototype.forEach.call(group.children, (el, i) => {
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min(i, 5) * 60 + "ms";
      targets.push(el);
    });
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal-in");
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
  );

  targets.forEach((el) => io.observe(el));
})();

(function () {
  // 統計数字のカウントアップ（初回視認時に1度だけ・900ms ease-out）。
  // HTMLには最終値を書いてあるため、JSなし・reduced-motionでは静的表示になる。
  const els = document.querySelectorAll("[data-count]");
  if (
    els.length === 0 ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    !("IntersectionObserver" in window)
  ) {
    return;
  }

  const DURATION = 900;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        io.unobserve(entry.target);
        const el = entry.target;
        const target = Number(el.getAttribute("data-count"));
        if (!Number.isFinite(target)) {
          return;
        }
        let startedAt = null;
        const step = (now) => {
          if (startedAt === null) {
            startedAt = now;
          }
          const p = Math.min(1, (now - startedAt) / DURATION);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(target * eased));
          if (p < 1) {
            requestAnimationFrame(step);
          }
        };
        requestAnimationFrame(step);
      });
    },
    { threshold: 0.6 }
  );

  els.forEach((el) => io.observe(el));
})();

(function () {
  // 手数料表の横スクロール示唆: スクロール可能なときだけヒントを表示し、
  // 一度スクロールしたら役目を終えたとみなして消す。
  const wrap = document.querySelector(".table-wrap");
  const hint = document.querySelector("[data-scroll-hint]");

  if (!wrap || !hint) {
    return;
  }

  let dismissed = false;

  const update = () => {
    const scrollable = wrap.scrollWidth > wrap.clientWidth + 4;
    hint.classList.toggle("is-visible", scrollable && !dismissed);
  };

  update();
  window.addEventListener("resize", update);

  wrap.addEventListener(
    "scroll",
    () => {
      dismissed = true;
      update();
    },
    { passive: true, once: true }
  );
})();

(function () {
  // つかいかた動画。LP 全体を遅くしないため、読み込み時は iframe も YouTube への通信も一切しない。
  // - 最初はポスター画像（loading="lazy"）のリンクだけ。押されたら YouTube の埋め込み（iframe）を作って再生する
  // - 一覧（.video-item）や各セクションの「動画で見る」（[data-video-link]）から回を選べる
  // - URL の #video-how-NN で回を指定して開ける（共有用。開いただけでは再生しない）
  // - JS なし：ポスターと一覧の各リンクが YouTube の動画ページを開く
  // - 動画の ID は data-youtube（11 文字）。空の回は iframe を作らず、ポスターのリンクにも飛ばさない
  //   （ID は scripts/set-youtube-ids.mjs で入れる）
  // - YouTube の IFrame Player API（外部 JS）は読まない。再生の開始・終了のイベントは取れないので、
  //   video_play は「ポスターや一覧を押して再生を始めたとき」に回ごとに 1 回だけ送る（video_complete は送らない）
  // 文字は textContent でしか入れない。iframe も createElement と setAttribute だけで作る
  // （innerHTML・srcdoc は使わない。Trusted Types / CSP を崩さない）。
  const frame = document.querySelector("[data-video-frame]");
  const facade = frame ? frame.querySelector("[data-video-poster]") : null;
  if (!frame || !facade) {
    return;
  }

  const items = Array.prototype.slice.call(document.querySelectorAll(".video-item[data-video]"));
  const isEnglish = document.documentElement.lang === "en";
  // 埋め込みは youtube-nocookie.com から（_headers の frame-src と同じ）
  const EMBED_ORIGIN = "https://www.youtube-nocookie.com";
  const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
  const played = {};
  let player = null;
  // iframe が今読んでいる YouTube の ID
  let playerYt = "";
  // 今の回（一覧がないページは、ポスターのリンクから作る）
  let state = {
    id: facade.getAttribute("data-video") || "",
    yt: facade.getAttribute("data-youtube") || "",
    label: (facade.getAttribute("aria-label") || "").replace(/^(再生する：|Play: )/, ""),
  };

  const track = (name, params) => {
    document.dispatchEvent(new CustomEvent("stblpay:analytics", {
      detail: { name, params },
    }));
  };
  const hasYt = (yt) => YOUTUBE_ID.test(yt);
  const embedUrl = (yt) =>
    EMBED_ORIGIN + "/embed/" + yt + "?autoplay=1&rel=0&playsinline=1&hl=" + (isEnglish ? "en" : "ja");
  // ポスターは YouTube のサムネイルを使わず、いつもサイト側（最初の img と同じフォルダ）から出す
  const posterImg = facade.querySelector("img");
  const posterDir = posterImg ? (posterImg.getAttribute("src") || "").replace(/[^/]*$/, "") : "";
  const posterOf = (id, size) => posterDir + id + (size === 640 ? "-640" : "") + ".webp";

  // 再生する意思があるとき（ポスターや一覧の回にポインタが乗った・フォーカスが来た）だけ、
  // YouTube への接続を先に済ませておく（最初の再生で DNS・TLS の待ちを減らす）。1 回だけ。
  // スクロールで近づいただけでは、Google に接続しない
  let warmed = false;
  const warmUp = () => {
    if (warmed) {
      return;
    }
    warmed = true;
    if (document.querySelector('link[rel="preconnect"][href="' + EMBED_ORIGIN + '"]')) {
      return;
    }
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.setAttribute("href", EMBED_ORIGIN);
    document.head.appendChild(link);
  };
  const warmOn = (el) => {
    el.addEventListener("pointerenter", warmUp);
    el.addEventListener("focusin", warmUp);
  };
  warmOn(facade);

  // 今の回を iframe で再生する。回を替えるときは iframe を作り直す
  // （同じ iframe の src を差し替えると、そのたびにブラウザの履歴が 1 つ増え、
  // 「戻る」でページを離れられなくなる。作ったばかりの iframe の最初の読み込みは履歴を増やさない）。
  // ID が空の回は何もしない（iframe があれば、前の回のまま）。作った iframe を返す
  const startPlayback = () => {
    if (!hasYt(state.yt)) {
      return player;
    }
    if (player && playerYt === state.yt) {
      // もう同じ回を読んでいる。読み直さない（途中で止めない）
      return player;
    }
    const next = document.createElement("iframe");
    next.setAttribute("title", state.label);
    next.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture; fullscreen");
    next.setAttribute("allowfullscreen", "");
    // サイトは Referrer-Policy: no-referrer なので、これが無いと YouTube がエラー 153 を返す
    next.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    next.setAttribute("width", "1920");
    next.setAttribute("height", "1080");
    next.setAttribute("data-video-player", "");
    next.setAttribute("src", embedUrl(state.yt));
    frame.replaceChild(next, player || facade);
    player = next;
    playerYt = state.yt;
    if (state.id && !played[state.id]) {
      played[state.id] = true;
      track("video_play", { video_id: state.id });
    }
    return player;
  };

  const play = (focus) => {
    const v = startPlayback();
    if (focus && v) {
      // 選んだ回をスクリーンリーダーにも伝える（iframe の title が読まれる）
      v.focus({ preventScroll: true });
    }
  };

  // 回を選んだことを、ポスターに映す（iframe が既にあるときは、play() が iframe を作り直す）
  const show = (id, yt, href, label) => {
    state = { id, yt, label };
    if (player) {
      return;
    }
    facade.setAttribute("href", href);
    facade.setAttribute("data-video", id);
    facade.setAttribute("data-youtube", yt);
    facade.setAttribute("aria-label", (isEnglish ? "Play: " : "再生する：") + label);
    if (posterImg) {
      posterImg.setAttribute("srcset", posterOf(id, 640) + " 640w, " + posterOf(id, 1280) + " 1280w");
      posterImg.setAttribute("src", posterOf(id, 1280));
    }
  };

  // 修飾キー付き（新しいタブで開く等）か
  const isModified = (event) => event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;

  // 中クリック（auxclick）でも、ID が空のうちは空の watch URL を開かせない
  facade.addEventListener("auxclick", (event) => {
    if (!hasYt(state.yt)) {
      event.preventDefault();
    }
  });

  facade.addEventListener("click", (event) => {
    // 修飾キー付きは、ブラウザに任せる（YouTube の動画ページが開く）。
    // ただし ID が空のうちは、空の watch URL を開かせない
    if (isModified(event) && hasYt(state.yt)) {
      return;
    }
    event.preventDefault();
    if (!isModified(event)) {
      play(true);
    }
  });

  // 一覧がないページ（英語版は 1 本だけ）はここまで
  if (items.length === 0) {
    return;
  }

  const stage = document.getElementById("video-stage") || frame;
  const field = (name) => document.querySelector('[data-video-field="' + name + '"]');
  const fields = {
    no: field("no"),
    title: field("title"),
    desc: field("desc"),
    dur: field("dur"),
  };
  const nextButton = document.querySelector("[data-video-next]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let current = Math.max(
    0,
    items.findIndex((el) => el.getAttribute("aria-current") === "true")
  );

  const titleOf = (item) => {
    const el = item.querySelector(".video-item-title");
    return el ? el.textContent.trim() : "";
  };

  const indexOf = (id) => items.findIndex((el) => el.getAttribute("data-video") === id);

  items.forEach(warmOn);

  const select = (index, options) => {
    const opts = options || {};
    const item = items[index];
    if (!item) {
      return;
    }
    const id = item.getAttribute("data-video");
    const changed = state.id !== id;
    current = index;

    show(
      id,
      item.getAttribute("data-youtube") || "",
      item.getAttribute("href"),
      "すてぶるペイのつかいかた " + item.getAttribute("data-no") + " " + titleOf(item) +
        "（" + item.getAttribute("data-dur") + "）"
    );

    if (fields.no) fields.no.textContent = item.getAttribute("data-no") || "";
    if (fields.title) fields.title.textContent = titleOf(item);
    if (fields.desc) fields.desc.textContent = item.getAttribute("data-desc") || "";
    if (fields.dur) fields.dur.textContent = item.getAttribute("data-dur") || "";

    items.forEach((el) => el.removeAttribute("aria-current"));
    item.setAttribute("aria-current", "true");

    if (nextButton) {
      const last = index >= items.length - 1;
      // 最後の回でボタンを隠すとき、フォーカスが行き場を失わないようプレイヤー（iframe）へ移す。
      // 再生できない回（ID が空）のときは、ポスターへ
      if (last && document.activeElement === nextButton) {
        ((opts.play ? startPlayback() : player) || facade).focus({ preventScroll: true });
      }
      nextButton.hidden = last;
    }

    if (opts.updateHash && window.history && history.replaceState) {
      history.replaceState(null, "", "#video-" + id);
    }

    if (opts.scroll) {
      stage.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }

    if (changed) {
      track("video_select", { video_id: id, via: opts.via || "list" });
    }

    if (opts.play) {
      play(opts.focus);
    }
  };

  items.forEach((item, index) => {
    item.addEventListener("auxclick", (event) => {
      if (!hasYt(item.getAttribute("data-youtube") || "")) {
        event.preventDefault();
      }
    });
    item.addEventListener("click", (event) => {
      // 修飾キー付きは、ブラウザに任せる。ただし ID が空のうちは、空の watch URL を開かせない
      if (isModified(event) && hasYt(item.getAttribute("data-youtube") || "")) {
        return;
      }
      event.preventDefault();
      if (!isModified(event)) {
        select(index, { play: true, scroll: true, updateHash: true, focus: true, via: "list" });
      }
    });
  });

  document.querySelectorAll("[data-video-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const index = indexOf(link.getAttribute("data-video-link"));
      if (index < 0) {
        return;
      }
      event.preventDefault();
      select(index, { play: true, scroll: true, updateHash: true, focus: true, via: "section-link" });
    });
  });

  if (nextButton) {
    nextButton.addEventListener("click", () => {
      select(current + 1, { play: true, updateHash: true, via: "next" });
    });
    nextButton.hidden = current >= items.length - 1;
  }

  // 共有された #video-how-NN で開いたとき（再生はしない）
  const match = /^#video-(how-[0-9a-z]+)$/.exec(location.hash);
  if (match) {
    const index = indexOf(match[1]);
    if (index >= 0) {
      select(index, { scroll: true });
    }
  }
})();
