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
      // 解説：一覧のカード・記事の関連欄から、どの記事へ進んだか
      const learnFrom = link.closest(".learn-cards") ? "learn_hub" : link.closest(".learn-related") ? "learn_related" : "";
      if (learnFrom) {
        event("select_content", { content_type: learnFrom, item_id: href });
        return;
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
      // 図の「動きを止める／動かす」。押したあとの名前（data-stopped）で、止めたか動かしたかを送る
      const img = button.closest("figure") && button.closest("figure").querySelector("img");
      event("figure_toggle", { figure: img ? (img.getAttribute("src") || "").split("/").pop() : "", stopped: button.getAttribute("data-stopped") === "true" });
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

  // LLMO の計測：AI の回答（ChatGPT・Perplexity・Claude・Gemini・Copilot）のリンクから来た閲覧を、来た元の名前つきで数える
  const AI_REFERRERS = { "chatgpt.com": "chatgpt", "chat.openai.com": "chatgpt", "perplexity.ai": "perplexity", "www.perplexity.ai": "perplexity", "claude.ai": "claude", "gemini.google.com": "gemini", "copilot.microsoft.com": "copilot" };
  try {
    const refHost = document.referrer ? new URL(document.referrer).hostname : "";
    if (AI_REFERRERS[refHost]) event("ai_referral", { ai_source: AI_REFERRERS[refHost], landing_page: location.pathname });
  } catch (error) {}

  document.addEventListener("stblpay:analytics", (customEvent) => {
    const detail = customEvent.detail || {};
    if (!detail.name) {
      return;
    }
    event(detail.name, detail.params || {});
  });
})();
