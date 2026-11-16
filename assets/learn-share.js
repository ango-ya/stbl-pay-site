// 解説の共有欄の「リンクをコピー」。コピーできる環境でだけボタンを出す（JS が無いときは li の hidden のまま）
(function () {
  "use strict";

  if (!navigator.clipboard) {
    return;
  }
  document.querySelectorAll(".learn-share-copy").forEach((button) => {
    const done = button.parentElement.querySelector(".learn-share-done");
    button.parentElement.hidden = false;
    button.addEventListener("click", () => {
      navigator.clipboard.writeText(button.getAttribute("data-url")).then(
        () => { done.textContent = button.getAttribute("data-done"); },
        () => { done.textContent = button.getAttribute("data-fail"); }
      );
    });
  });
})();
