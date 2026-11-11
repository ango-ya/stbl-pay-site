(function () {
  "use strict";

  const idMeta = document.querySelector('meta[name="google-analytics-id"]');
  const measurementId = idMeta ? (idMeta.getAttribute("content") || "").trim() : "";

  if (!/^G-[A-Z0-9]+$/.test(measurementId)) {
    return;
  }

  const gtagUrl = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);

  if (window.trustedTypes && window.trustedTypes.createPolicy) {
    try {
      window.trustedTypes.createPolicy("default", {
        createHTML: (value) => String(value)
          .replace(/<\s*(\/?\s*(script|svg|math|iframe|object|embed|link|base)\b)/gi, "&lt;$1")
          .replace(/([\s/])on[a-z]+\s*=/gi, "$1data-x="),
        createScript: () => { throw new TypeError("TT: dynamic script forbidden"); },
        createScriptURL: (value) => {
          const url = String(value);
          if (url.startsWith("https://www.googletagmanager.com/gtag/js?id=G-")) {
            return url;
          }
          throw new TypeError("TT: blocked script URL");
        },
      });
    } catch (error) {}
  }

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = window.gtag || gtag;

  window.gtag("js", new Date());
  window.gtag("config", measurementId, {
    anonymize_ip: true,
    cookie_flags: "SameSite=None;Secure",
    page_path: location.pathname + location.search,
    page_title: document.title,
  });

  // 本番の人の閲覧だけを送る。E2E（手元の 127.0.0.1、CI の GitHub Actions）や自動操作のブラウザも本物の測定 ID で送っていたため
  if (location.hostname !== "stbl-pay.com" || navigator.webdriver) {
    return;
  }

  // 自分たちの閲覧を数えないための印。?ga=off を付けて一度開くとこのブラウザは送らない。?ga=on で戻す
  // localStorage が使えない環境でも、?ga=off を付けたその閲覧は送らない
  const gaFlag = new URLSearchParams(location.search).get("ga");
  let optedOut = gaFlag === "off";
  try {
    if (gaFlag === "off") localStorage.setItem("stblpay-ga-off", "1");
    if (gaFlag === "on") localStorage.removeItem("stblpay-ga-off");
    optedOut = optedOut || localStorage.getItem("stblpay-ga-off") === "1";
  } catch (error) {}
  if (optedOut) {
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = gtagUrl;
  document.head.appendChild(script);

  const event = (name, params) => {
    if (typeof window.gtag !== "function") {
      return;
    }
    window.gtag("event", name, Object.assign({
      page_path: location.pathname,
    }, params || {}));
  };

  document.addEventListener("click", (clickEvent) => {
    const target = clickEvent.target;
    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest("a[href]");
    if (link) {
      const href = link.getAttribute("href") || "";
      // 解説：一覧の「困りごとから探す」・カード、記事の関連欄から、どの記事へ進んだか。item_id は # 以降を外したパス（節へのリンクも記事単位で数える）
      const articlePath = (h) => h.split("#")[0];
      const learnFrom = link.closest(".learn-needs") ? "learn_needs" : link.closest(".learn-cards") ? "learn_hub" : link.closest(".learn-related") ? "learn_related" : "";
      if (learnFrom) {
        event("select_content", { content_type: learnFrom, item_id: articlePath(href) });
        return;
      }
      // 解説・方針の本文と末尾の箱から、LP・相談・docs・Sandbox・方針へ進んだこと（ヘッダー・フッターは対象外）。クラスの有無でなく行き先で見分ける
      const article = link.closest(".learn-article");
      if (article) {
        const u = new URL(href, location.href);
        const where = link.closest(".learn-about") ? "learn_about" : link.closest(".learn-sources") ? "learn_sources" : link.closest(".learn-body") ? "learn_body" : "learn_other";
        let exitType = "";
        if (u.origin === location.origin) {
          if (/^\/(en\/)?$/.test(u.pathname)) exitType = u.hash === "#early-access" ? "consult" : "lp";
          else if (/^\/docs\/(en\/)?testing\/sandbox\//.test(u.pathname)) exitType = "sandbox";
          else if (u.pathname.startsWith("/docs/")) exitType = "docs";
          else if (u.pathname.startsWith("/policy/")) exitType = "policy";
          else if (where === "learn_body" && /^\/(en\/)?learn\//.test(u.pathname) && u.pathname !== location.pathname) {
            event("select_content", { content_type: "learn_body", item_id: articlePath(href) });
            return;
          }
        }
        if (exitType) {
          event("cta_click", {
            cta_label: (link.textContent || "").trim().slice(0, 80),
            cta_destination: href,
            cta_location: where,
            exit_type: exitType,
          });
          return;
        }
      }
      if (link.matches(".header-cta, .button, .text-link, .header-lp-link, .shop-nav-lp")) {
        event("cta_click", {
          cta_label: (link.textContent || "").trim().slice(0, 80),
          cta_destination: href,
        });
      }
      return;
    }

    const button = target.closest("button");
    if (!button) {
      return;
    }

    if (button.matches(".learn-fig-toggle")) {
      // 図の「動きを止める／動かす」。押したあとの名前（data-stopped）で、止めたか動かしたかを送る。figure は記事のスラッグつき（別の記事の同じファイル名と区別する）
      const img = button.closest("figure") && button.closest("figure").querySelector("img");
      event("figure_toggle", { figure: img ? (img.getAttribute("src") || "").split("/").slice(-2).join("/") : "", stopped: button.getAttribute("data-stopped") === "true" });
    } else if (button.id === "openJpyc") {
      event("demo_payment_start", { demo_area: "cart" });
    } else if (button.id === "resetDemo") {
      event("demo_reset", { demo_area: "cart" });
    }
  }, { passive: true });

  const bindFormStart = () => {
    const form = document.querySelector("[data-early-form]");
    if (!form) {
      return;
    }
    let started = false;
    form.addEventListener("focusin", () => {
      if (started) {
        return;
      }
      started = true;
      event("form_start", { form_id: "early-access" });
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindFormStart, { once: true });
  } else {
    bindFormStart();
  }

  // FAQ の開閉：どの問いが読まれたか（summary の文の先頭 80 字）。1 回の閲覧で同じ問いは 1 回だけ送る
  const faqOpened = new Set();
  document.addEventListener("toggle", (toggleEvent) => {
    const d = toggleEvent.target;
    const summary = d instanceof HTMLDetailsElement && d.open && d.closest(".faq-list") ? d.querySelector("summary") : null;
    const question = summary ? (summary.textContent || "").trim().slice(0, 80) : "";
    if (question && !faqOpened.has(question)) {
      faqOpened.add(question);
      event("faq_open", { question: question });
    }
  }, true); // toggle は泡立たないので、捕捉の段で受ける

  // LLMO の計測：AI の回答（ChatGPT・Perplexity・Claude・Gemini・Copilot）のリンクから来た閲覧を、来た元の名前つきで数える
  // 参照元のホスト（サブドメインも）を先に見て、無ければ utm_source（chatgpt.com など。アプリから開くと参照元が空になる）で判定する
  const AI_SOURCES = { "chatgpt.com": "chatgpt", "chat.openai.com": "chatgpt", "perplexity.ai": "perplexity", "claude.ai": "claude", "gemini.google.com": "gemini", "copilot.microsoft.com": "copilot", "grok.com": "grok", "felo.ai": "felo", "genspark.ai": "genspark", "mistral.ai": "mistral", "deepseek.com": "deepseek", "you.com": "you", "meta.ai": "meta" };
  const aiName = (value) => {
    const v = String(value || "").trim().toLowerCase();
    const domain = Object.keys(AI_SOURCES).find((d) => v === d || v.endsWith("." + d));
    return domain ? AI_SOURCES[domain] : Object.values(AI_SOURCES).includes(v) ? v : "";
  };
  try {
    const aiSource = aiName(document.referrer ? new URL(document.referrer).hostname : "") || aiName(new URLSearchParams(location.search).get("utm_source"));
    if (aiSource) event("ai_referral", { ai_source: aiSource, landing_page: location.pathname });
  } catch (error) {}

  document.addEventListener("stblpay:analytics", (customEvent) => {
    const detail = customEvent.detail || {};
    if (!detail.name) {
      return;
    }
    event(detail.name, detail.params || {});
  });
})();
