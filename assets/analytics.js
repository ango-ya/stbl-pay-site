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

    if (button.id === "openJpyc") {
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

  document.addEventListener("stblpay:analytics", (customEvent) => {
    const detail = customEvent.detail || {};
    if (!detail.name) {
      return;
    }
    event(detail.name, detail.params || {});
  });
})();
