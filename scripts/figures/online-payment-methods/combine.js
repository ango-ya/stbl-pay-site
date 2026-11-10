// 決済方法の組み合わせ方（本文「おすすめの決済方法の組み合わせ方」）。
// まずカードと現金に近い方法（コンビニ払い・銀行振込）、そこへ後払いと QR コード決済を足し、デジタル商品などではステーブルコイン決済も足せる。
// 文字は 3 か所（各段の名前）。段を上から足していき、見ている段だけ濃くする。すてぶるくんは右下の床に立つ。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, track, ramp, SNAP, PLAY, drawChan, drawKun } = FX;
    // 後払い：箱と、あとで払う時計
    const parcel = () => {
      rr(ctx, -40, -26, 80, 62, 6); shape(ctx, C.light);
      rr(ctx, -9, -26, 18, 62, 0); shape(ctx, C.white, C.navy, 4);
      at(ctx, 30, -30, 0.55, 1, () => ICON.clock(ctx, 0.12));
    };
    // QR コード：3 つの角の四角と、まばらな点
    const qr = () => {
      rr(ctx, -42, -42, 84, 84, 8); shape(ctx, C.white);
      for (const [x, y] of [[-30, -30], [8, -30], [-30, 8]]) {
        rr(ctx, x, y, 22, 22, 3); shape(ctx, C.navy, null);
        rr(ctx, x + 6, y + 6, 10, 10, 1); shape(ctx, C.white, null);
      }
      for (const [x, y] of [[10, 10], [26, 10], [18, 22], [10, 28], [28, 28]]) { rr(ctx, x - 4, y - 4, 8, 8, 1); shape(ctx, C.navy, null); }
    };
    const ROWS = [
      { y: 112, start: 0.2, label: "まずは", icons: [{ x: 480, draw: () => ICON.card(ctx), s: 1.1 }, { x: 630, draw: () => COIN.yen(ctx), s: 1.5 }] },
      { y: 264, start: 3.1, label: "お店に合わせて足す", icons: [{ x: 480, draw: parcel, s: 1.2 }, { x: 630, draw: qr, s: 1.2 }] },
      { y: 414, start: 6.0, label: "選択肢の一つ", icons: [{ x: 480, draw: () => COIN.stable(ctx), s: 1.5 }] },
    ];
    const END = 7.2;
    ROWS.forEach((r, i) => {
      const next = i < ROWS.length - 1 ? ROWS[i + 1].start : Infinity; // 次の段が出たら、この段を薄くする
      const dim = t >= next ? 1 - 0.62 * ramp(t, next, next + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;
      ctx.save();
      ctx.globalAlpha = dim;
      at(ctx, 36, r.y, 1, ramp(t, r.start, r.start + 0.3), () => text(ctx, r.label, 0, 0, { size: 40, align: "left" }));
      r.icons.forEach((ic, k) => {
        const s = track(t, r.start + 0.15 + 0.2 * k, k ? PLAY : SNAP);
        at(ctx, ic.x, r.y, s * ic.s, s, ic.draw);
      });
      ctx.restore();
    });
    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "palm", x: 872, h: 330, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 620, floor: 532, w: 112, eyes: t > END ? "open" : "left", mouth: t > 6.0 && t < 6.8 ? "o" : "rest", blinkAt: [2.5, 8.6] });
  },
});
