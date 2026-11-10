(function () {
  "use strict";
  // 解説ページの図（figure.learn-fig）に「動きを止める」ボタンを付ける（WCAG 2.2.2 一時停止・停止・非表示）。
  // 押すと picture の中の絵を完成図（-still.webp）に替え、もう一度押すとアニメに戻す。
  // - CSP・Trusted Types に合わせて、要素の作成・textContent・属性（srcset・data-stopped）の変更だけで動かす（innerHTML・style は使わない）
  // - JS が無いときはボタンを出さない（このスクリプトが作る）
  // - prefers-reduced-motion: reduce の人は、初めから完成図（HTML の picture のまま）で、ボタンは「動かす」。押すとアニメになる
  // - 状態はボタンの名前（「動きを止める」／「動かす」）で表す。名前が変わるので aria-pressed は使わない（ARIA の決まり）。見た目用に data-stopped
  // - 見ている途中で motion の設定が変わったら（matchMedia の change）、その設定の初期状態（絵とボタンの名前）に戻す
  // shortcut: 止めるのは picture の WebP の source だけ。WebP を表示できず GIF の img を出すブラウザでは止まらない。主要なブラウザはどれも WebP を表示できるので、それで済ませている
  const mql = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  let reduce = !!(mql && mql.matches);
  const resets = [];

  document.querySelectorAll("figure.learn-fig").forEach(function (fig) {
    const sources = fig.querySelectorAll("picture source");
    const anim = fig.querySelector('picture source[media="(prefers-reduced-motion: no-preference)"]');
    const still = fig.querySelector("picture source:not([media])");
    if (!anim || !still) {
      return;
    }
    const animUrl = anim.getAttribute("srcset");
    const stillUrl = still.getAttribute("srcset");
    // 止める・動かす：どの source が選ばれても、その絵に
    const show = function (url) {
      sources.forEach(function (s) {
        s.setAttribute("srcset", url);
      });
    };

    const button = document.createElement("button");
    button.type = "button";
    button.className = "learn-fig-toggle";
    const label = function (stopped) {
      button.textContent = stopped ? "動かす" : "動きを止める";
      button.setAttribute("data-stopped", stopped ? "true" : "false");
    };
    // 初期状態：HTML の picture のまま（motion の設定でブラウザが選ぶ）。reduce なら完成図なので「動かす」
    const reset = function () {
      anim.setAttribute("srcset", animUrl);
      still.setAttribute("srcset", stillUrl);
      label(reduce);
    };
    reset();
    resets.push(reset);
    button.addEventListener("click", function () {
      const stop = button.getAttribute("data-stopped") !== "true";
      label(stop);
      if (stop) {
        show(stillUrl);
      } else if (reduce) {
        show(animUrl); // reduce の人が自分で動かしたとき
      } else {
        reset();
      }
    });
    fig.insertBefore(button, fig.querySelector("figcaption"));
  });

  if (mql && mql.addEventListener) {
    mql.addEventListener("change", function (e) {
      reduce = e.matches;
      resets.forEach(function (reset) {
        reset();
      });
    });
  }
})();
