(function () {
  "use strict";
  // 解説ページの図（figure.learn-fig）に「動きを止める」ボタンを付ける（WCAG 2.2.2 一時停止・停止・非表示）。
  // 押すと picture の中の絵を完成図（-still.webp）に替え、もう一度押すとアニメに戻す。
  // - CSP・Trusted Types に合わせて、要素の作成・textContent・属性（srcset・aria-pressed）の変更だけで動かす（innerHTML・style は使わない）
  // - JS が無いときはボタンを出さない（このスクリプトが作る）
  // - prefers-reduced-motion: reduce の人は、初めから完成図（HTML の picture のまま）で、ボタンは押された状態。押すとアニメになる
  // - aria-pressed="true" は「止めている」。ボタンの名前は変えない
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll("figure.learn-fig").forEach(function (fig) {
    const sources = fig.querySelectorAll("picture source");
    const anim = fig.querySelector('picture source[media="(prefers-reduced-motion: no-preference)"]');
    const still = fig.querySelector("picture source:not([media])");
    if (!anim || !still) {
      return;
    }
    const animUrl = anim.getAttribute("srcset");
    const stillUrl = still.getAttribute("srcset");
    // 止める：どの source が選ばれても完成図に。動かす：どの source が選ばれてもアニメに
    const show = function (url) {
      sources.forEach(function (s) {
        s.setAttribute("srcset", url);
      });
    };

    const button = document.createElement("button");
    button.type = "button";
    button.className = "learn-fig-toggle";
    button.textContent = "動きを止める";
    button.setAttribute("aria-pressed", reduce ? "true" : "false");
    button.addEventListener("click", function () {
      const stop = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", stop ? "true" : "false");
      if (stop) {
        show(stillUrl);
      } else if (reduce) {
        show(animUrl); // reduce の人が自分で動かしたとき
      } else {
        anim.setAttribute("srcset", animUrl);
        still.setAttribute("srcset", stillUrl);
      }
    });
    fig.insertBefore(button, fig.querySelector("figcaption"));
  });
})();
