// JPYC の受け取り方 2 つ（本文「お店が JPYC で受け取る 2 つの方法」の表）。
// 自分で受ける：購入者が送り、お店が送金と注文を自分で突き合わせる（虫めがね）。
// 決済サービスを使う：購入者が送るのは同じで、サービスが決済ごとの状態を管理し、結果をお店に知らせる（点線とチェック）。
// サービスはお金の通り道の外に置く。文字は 2 か所（行の名前）。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const X = { buy: 300, mid: 456, shop: 612 }, S = 1.05;
    const ROWS = [
      { y: 120, start: 0.2, label: "自分で\n受ける" },
      { y: 372, start: 4.0, label: "決済\nサービス" },
    ];
    const END = 8.0;
    // 決済サービス：ブラウザの窓のような箱
    const service = () => {
      rr(ctx, -40, -30, 80, 60, 8); shape(ctx, C.white);
      ctx.beginPath(); ctx.rect(-37, -27, 74, 14); shape(ctx, C.blue, null);
      for (const y of [4, 16]) { ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-24, y); ctx.lineTo(24, y); shape(ctx, null, C.light, 5); }
    };

    ROWS.forEach((r, i) => {
      const s0 = r.start, next = ROWS[i + 1] ? ROWS[i + 1].start : Infinity;
      const dim = t >= next ? 1 - 0.62 * ramp(t, next, next + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;
      ctx.save();
      ctx.globalAlpha = dim;
      const y = r.y;
      const pop = (d) => track(t, s0 + d, SNAP);
      at(ctx, 36, y, 1, ramp(t, s0, s0 + 0.3), () => text(ctx, r.label, 0, 0, { size: 40, align: "left" }));
      at(ctx, X.buy - 30, y, pop(0.05) * S, pop(0.05), () => ICON.phone(ctx));
      at(ctx, X.shop, y, pop(0.2) * S, pop(0.2), () => ICON.shop(ctx));
      // 購入者から、お店へ直接（どちらの行も同じ）
      const a = [X.buy + 10, y], b = [X.shop - 70, y];
      const u = track(t, s0 + 0.7, HEAVY);
      arrow(ctx, a, b, u, { color: C.blue, width: 6 });
      const c = track(t, s0 + 0.5, PLAY);
      at(ctx, lerp(a[0] + 10, b[0] + 30, u), y - 66, c * 0.95, c, () => COIN.stable(ctx));
      if (i === 0) {
        // お店が自分で突き合わせる
        const m = track(t, s0 + 2.0, PLAY);
        at(ctx, X.shop + 50, y - 62, m * 0.62, m, () => ICON.magnifier(ctx));
      } else {
        // サービスが決済ごとの状態を管理し、結果をお店に知らせる
        const sv = track(t, s0 + 0.9, SNAP);
        at(ctx, X.mid - 10, y - 124, sv * 1.15, sv, () => service());
        const n = track(t, s0 + 2.2, HEAVY);
        arrow(ctx, [X.mid + 44, y - 124], [X.shop + 50, y - 98], n, { ctrl: [X.shop + 50, y - 124], color: C.gray, width: 5, dash: [2, 12] });
        const ok = track(t, s0 + 3.0, PLAY);
        at(ctx, X.shop + 50, y - 62, ok * 0.95, ok, () => ICON.check(ctx));
      }
      ctx.restore();
    });

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 372, floor: 532, w: 112, eyes: t > 4.0 && t < END ? "right" : "open", blinkAt: [1.6, 8.8] });
  },
});
