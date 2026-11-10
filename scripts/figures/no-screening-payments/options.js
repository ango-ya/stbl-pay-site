// 受け取り方ごとの、カードの加盟店審査の有無（本文「加盟店審査のいらない受け取り方」の表の要点）。
// カード：契約の前にお店が調べられる（虫めがね）。銀行振込・ステーブルコイン決済：カードの仕組みではないので、その審査はない（サービスごとの規約はある）。
// 文字は 3 か所（各行の名前）。コンビニ払いは表にあるが、図は 3 行にとどめる。
FX.figure({
  duration: 11,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, arrow, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan } = FX;
    const X = { buy: 300, mid: 456, shop: 612 }, S = 1.05;
    const ROWS = [
      { y: 104, start: 0.2, label: "カード", mid: "card" },
      { y: 278, start: 3.6, label: "銀行振込", mid: "bank" },
      { y: 452, start: 5.9, label: "ステーブル\nコイン", mid: "chain" },
    ];
    const END = 7.8; // 3 行目が終わったら、全部の行を元の濃さに戻す

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
      const coinTo = (u) => [lerp(X.mid, X.shop - 40, u), lerp(y - 4, y - 66, u)];

      if (r.mid === "card") {
        // カードの契約：お店が調べられている間、お金は動かない。調べ終わると届く
        at(ctx, X.mid, y, pop(0.12) * S, pop(0.12), () => ICON.card(ctx));
        arrow(ctx, a1, b1, track(t, s0 + 0.5, HEAVY), { color: C.gray, width: 5, dash: [2, 12] });
        const m = track(t, s0 + 1.0, PLAY);
        const wob = Math.sin((t - s0 - 1.4) * 9) * 8 * ramp(t, s0 + 1.4, s0 + 1.5) * (1 - ramp(t, s0 + 2.3, s0 + 2.6));
        at(ctx, X.shop + 54 + wob, y - 64, m * 0.9, m, () => ICON.magnifier(ctx));
        const u2 = track(t, s0 + 2.6, HEAVY);
        arrow(ctx, a2, b2, u2, { color: C.blue, width: 6 });
        const c = track(t, s0 + 2.5, PLAY);
        const p = coinTo(u2);
        at(ctx, p[0], p[1], c * 0.95, c, () => COIN.yen(ctx));
      } else if (r.mid === "bank") {
        // 銀行振込：カードの審査の仕組みはない
        at(ctx, X.mid, y, pop(0.12) * S, pop(0.12), () => ICON.bank(ctx));
        arrow(ctx, a1, b1, track(t, s0 + 0.5, HEAVY), { color: C.blue, width: 6 });
        const u2 = track(t, s0 + 1.1, HEAVY);
        arrow(ctx, a2, b2, u2, { color: C.blue, width: 6 });
        const c = track(t, s0 + 0.5, PLAY);
        const p = u2 > 0 ? coinTo(u2) : [lerp(X.buy + 30, X.mid, track(t, s0 + 0.5, HEAVY)), y - 40];
        at(ctx, p[0], p[1], c * 0.95, c, () => COIN.yen(ctx));
      } else {
        // ステーブルコイン決済：ブロックチェーンで送る。カードの審査はない
        const u1 = track(t, s0 + 0.5, HEAVY), u2 = track(t, s0 + 1.0, HEAVY);
        arrow(ctx, a1, b2, Math.max(0, u1 * 0.5 + u2 * 0.5), { color: C.blue, width: 6 });
        at(ctx, X.mid, y + 2, 1.2, 1, () => ICON.chain(ctx, u1 * 3.4 - 0.2));
        const c = track(t, s0 + 0.4, PLAY);
        const x = lerp(X.buy + 30, X.shop - 40, u1 * 0.5 + u2 * 0.5);
        at(ctx, x, y - 66, c * 0.95, c, () => COIN.stable(ctx));
      }
      ctx.restore();
    });

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.3] });
  },
});
