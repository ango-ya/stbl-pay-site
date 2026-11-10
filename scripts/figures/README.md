# 解説ページの図（scripts/figures/）とサムネイル（scripts/learn-thumbs/）

解説ページ（/learn/）に入れるモーショングラフィックの図と、記事の冒頭・OGP のサムネイルを、コードで描いて書き出す。配信はしない（`scripts/` はビルドの対象外）。書き出した絵は `assets/learn/<slug>/` に置き、git に入れる。

## 書き出し

```sh
CONTACT_DIR=<採点用のフォルダ> node scripts/figures/render.mjs <slug>   # 図：<name>.gif・<name>.webp・<name>-still.webp
node scripts/learn-thumbs/make.mjs <slug>                              # サムネイル：og.png（1200×630）・thumb.webp
```

- 全部の形式を一時フォルダで作り、最後までデコードできること（`ffmpeg -v error -i <絵> -f null -` でエラーが出ない）・寸法・アニメかどうかを確かめてから差し替える。
- 差し替えは「1 図の 3 形式（`.gif`・`.webp`・`-still.webp`）」と「1 記事のサムネイルの 2 形式（`og.png`・`thumb.webp`）」を 1 つの単位として守る。今あるファイルを `.bak` に移してから新しいものを置き、途中で失敗したら単位の全部を `.bak` から戻す（新旧が混ざらない。`.new`・`.bak`・一時フォルダは残さない）。中身は `outputs.mjs`。
- 失敗したら終了コード 1 で止まる（図・記事の名前付き）。図のファイルが読めない・`FX.figure()` が呼ばれない・キャラクターの絵が読めないときは 20 秒以内に、ページでエラーが 1 件でも出たときはそこで止まる。コンタクトシートは差し替えの前に作る。
- 異常系のテスト：`npm run test:figures`（`node --test scripts/figures/outputs.test.mjs`。rename・コピーの途中の失敗、検査での失敗、壊れた PNG・途中で切れた WebP と GIF で、前のファイルが変わらず `.new`・`.bak`・一時フォルダが残らないこと）。書き出しと同じツール（ffmpeg・libwebp）が要るので、`npm run check` には入れていない（ツールの無い環境でも check が通るように）。
- 図のファイルは完成図のコマから始まる（読み込み中や最初のコマが空の図にならないように）。完成図の静止画は reduced-motion の人と「動きを止める」ボタン（`assets/learn-fig.js`）で使う。
- サムネイルの絵は `marketing/thumbnails/in/<slug>.png`（Astra の絵）があればそれ、無ければコードで描いた仮の絵。題名は `make.mjs` の `TITLES`。

## 決定性（同じ環境でだけ）

同じ入力から毎回同じバイト列になるのは、**同じ環境**（同じフォント・同じ版のブラウザとツール）で書き出したときだけ。乱数・時計は使わないが、文字の形はOSのフォント、縮小・圧縮はツールの版で変わる。フォントは同梱しない。別の環境で書き出すと絵がわずかに変わるので、書き出し直したら見比べてから commit する。

2026-11-10 に使った環境：

| もの | 版 |
|---|---|
| OS とフォント | macOS 26.6.2 の ヒラギノ角ゴシック（Hiragino Sans。図の文字は 700・800） |
| ブラウザ | Playwright 1.62.0 の Chromium 151.0.7922.34 |
| Node.js | v22.23.4 |
| ffmpeg・ffprobe | 9.0.2 |
| img2webp・cwebp・webpinfo（libwebp） | 1.6.0 |

## 図の書き方

1 図 1 ファイル（`scripts/figures/<slug>/<name>.js`）。見本は `stablecoin-payments/flow.js`。

```js
FX.figure({
  duration: 10, // 6〜12 秒。最後に完成図で 2 秒以上止める
  draw(ctx, t) { // 絵は t だけで決める（setTimeout・Math.random・CSS トランジションを使わない）
    const { ICON, at, text, track, SNAP, drawChan, drawKun } = FX;
    const s = track(t, 0.3, SNAP); // 0.3 秒から動き出すばね（SNAP / STD / HEAVY / PLAY）
    at(ctx, 200, 300, s * 1.4, s, () => ICON.bank(ctx));
    text(ctx, "発行体の窓口", 200, 400, { size: 40 });
    drawChan(ctx, t, { pose: "point", x: 872, h: 330 });   // 右下（絵が左を向いている）
    drawKun(ctx, t, { x: 380, floor: 532, w: 120 });      // 床に立つ（浮くのは寝ているときだけ）
  },
});
```

- 画面は 960×540、書き出しは幅 720。図の文字は 1 画面 3 か所まで、40px 前後（スマホで約 15px）。
- 線・矢印の灰色は `C.gray`（背景に対して 3:1 以上）。
- キャラクターの決まり（左右反転しない、お金を持たせない、運営をお金の流れの線の外に置く など）は README.md の「キャラクターの素材と動き」と、marketing/thumbnails/astra-prompts.md の共通ルール。
- 確かめるときは `scripts/figures/stage.html?fig=<slug>/<name>&play` をブラウザで開く。
