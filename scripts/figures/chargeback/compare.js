// カードのチャージバックと、ステーブルコイン決済の違い（本文「ステーブルコイン決済の場合」）。
// カード：購入者の申し立て（紙）で、売上がお店から購入者へ戻る。ステーブルコイン決済：確定した送金は、申し立てでは取り消せない（錠前）。返金は、お店から送り返す形。
// 文字は 3 か所（各行の名前と、「お店から送り返す」）。
FX.figure({
  duration: 12,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, along, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan } = FX;
    const X = { buy: 300, mid: 456, shop: 612 }, S = 1.0;
    const ROWS = [
      { y: 120, start: 0.2, label: "カード", mid: "card" },
      { y: 352, start: 5.0, label: "ステーブル\nコイン", mid: "chain" },
    ];
    const END = 9.5;
    const paper = () => {
      rr(ctx, -20, -26, 40, 52, 5); shape(ctx, C.white, C.navy, 4);
      ctx.lineCap = "round";
      for (const y of [-12, -1, 10]) { ctx.beginPath(); ctx.moveTo(-10, y); ctx.lineTo(y === 10 ? 3 : 10, y); shape(ctx, null, C.blue, 4); }
    };

    ROWS.forEach((r, i) => {
      const s0 = r.start, next = ROWS[i + 1] ? ROWS[i + 1].start : Infinity;
      const dim = t >= next ? 1 - 0.62 * ramp(t, next, next + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;
      ctx.save();
      ctx.globalAlpha = dim;
      const y = r.y;
      const pop = (d) => track(t, s0 + d, SNAP);
      at(ctx, 36, y, 1, ramp(t, s0, s0 + 0.3), () => text(ctx, r.label, 0, 0, { size: 40, align: "left" }));
      at(ctx, X.buy, y, pop(0.05) * S, pop(0.05), () => ICON.phone(ctx));
      at(ctx, X.shop, y, pop(0.2) * S, pop(0.2), () => ICON.shop(ctx));
      const a1 = [X.buy + 40, y], b1 = [X.mid - 62, y], a2 = [X.mid + 62, y], b2 = [X.shop - 66, y];
      const ret = { a: [X.shop - 30, y + 84], b: [X.buy + 30, y + 84] };
      const coinTo = (u) => [lerp(X.mid, X.shop - 40, u), lerp(y - 4, y - 66, u)];
      const paperAlong = (p) => [lerp(X.buy + 20, X.shop - 50, p), y - 74];

      if (r.mid === "card") {
        at(ctx, X.mid, y, pop(0.12) * S, pop(0.12), () => ICON.card(ctx));
        arrow(ctx, a1, b1, track(t, s0 + 0.5, HEAVY), { color: C.gray, width: 5, dash: [2, 12] });
        const u2 = track(t, s0 + 1.0, HEAVY);
        arrow(ctx, a2, b2, u2, { color: C.blue, width: 6 });
        const c = track(t, s0 + 0.9, PLAY);
        // 支払いの金額が、お店のところに届く
        const back = track(t, s0 + 3.7, HEAVY);
        const top = coinTo(u2), hop = ramp(t, s0 + 3.3, s0 + 3.7); // お店のところの金額が、そのまま戻りの矢印に乗る
        const p = back > 0 ? along(ret.a, ret.b, back * 0.7) : [lerp(top[0], ret.a[0], hop), lerp(top[1], ret.a[1], hop)];
        at(ctx, p[0], p[1], c * 0.95, c, () => COIN.yen(ctx));
        // 購入者の申し立て（紙）が、カード会社をへて、お店へ
        const q = track(t, s0 + 2.3, HEAVY);
        const pa = [lerp(X.buy + 20, X.mid, q), y - 74];
        at(ctx, pa[0], pa[1], 0.85 * ramp(t, s0 + 2.2, s0 + 2.5), 1, paper);
        // 売上が、お店から購入者へ戻る
        arrow(ctx, [ret.a[0], ret.a[1]], [ret.b[0], ret.b[1]], back, { color: C.blue, width: 6 });
      } else {
        const u1 = track(t, s0 + 0.5, HEAVY), u2 = track(t, s0 + 1.0, HEAVY);
        arrow(ctx, a1, b2, Math.max(0, u1 * 0.5 + u2 * 0.5), { color: C.blue, width: 6 });
        at(ctx, X.mid, y + 2, 1.2, 1, () => ICON.chain(ctx, u1 * 3.4 - 0.2));
        const c = track(t, s0 + 0.4, PLAY);
        const back = track(t, s0 + 3.6, HEAVY);
        const top = [lerp(X.buy + 30, X.shop - 40, u1 * 0.5 + u2 * 0.5), y - 66], hop = ramp(t, s0 + 3.2, s0 + 3.6);
        const p = back > 0 ? along(ret.a, ret.b, back * 0.7) : [lerp(top[0], ret.a[0], hop), lerp(top[1], ret.a[1], hop)]; // 矢じりが見えるよう、戻りは終点の手前で止める
        at(ctx, p[0], p[1], c * 0.95, c, () => COIN.stable(ctx));
        // 確定した送金は取り消せない（錠前）。購入者の申し立て（紙）は、お店の手前で止まる
        const lk = track(t, s0 + 1.8, PLAY);
        at(ctx, X.shop + 52, y - 62, lk * 0.95, lk, () => ICON.lock(ctx));
        const q = track(t, s0 + 2.3, HEAVY);
        const stop = ramp(t, s0 + 2.9, s0 + 3.3);
        const pa = paperAlong(Math.min(q, 0.78));
        at(ctx, pa[0] - 70 * stop, pa[1], 0.85 * ramp(t, s0 + 2.2, s0 + 2.5) * (1 - stop), 1, paper);
        // 返金は、お店から購入者へ送り返す
        arrow(ctx, [ret.a[0], ret.a[1]], [ret.b[0], ret.b[1]], back, { color: C.blue, width: 6 });
        at(ctx, X.mid, y + 134, 1, ramp(t, s0 + 3.8, s0 + 4.1), () => text(ctx, "お店から送り返す", 0, 0, { size: 36 }));
      }
      ctx.restore();
    });

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.3] });
  },
});
