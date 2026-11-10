// ステーブルコインと暗号資産（ビットコインなど）の価値の動き（本文「暗号資産（ビットコイン）との違い」の「価値の決まり方」）。
// ステーブルコインは法定通貨などに連動するよう設計されていて、点線（額面）のそばを進む。暗号資産は市場での売買で決まり、大きく動く。
// 文字は 2 か所（行の名前）。数字は書かない。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, COIN, at, text, rr, shape, track, ramp, lerp, SNAP, PLAY, drawChan, drawKun } = FX;
    const PX = 316, PW = 340, PH = 170;
    const ROWS = [
      { y: 130, start: 0.2, label: "ステーブル\nコイン", coin: "stable", color: C.blue, f: (x) => 5 * Math.sin(x * 0.045) },
      { y: 350, start: 3.6, label: "暗号資産", coin: "crypto", color: C.navy, f: (x) => 50 * Math.sin(x * 0.026 + 0.6) + 18 * Math.sin(x * 0.07 + 1.2) },
    ];
    const END = 7.8;

    ROWS.forEach((r, i) => {
      const s0 = r.start, next = ROWS[i + 1] ? ROWS[i + 1].start : Infinity;
      const dim = t >= next ? 1 - 0.62 * ramp(t, next, next + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;
      ctx.save();
      ctx.globalAlpha = dim;
      const y = r.y;
      const pop = track(t, s0, SNAP);
      at(ctx, 36, y, 1, ramp(t, s0, s0 + 0.3), () => text(ctx, r.label, 0, 0, { size: 40, align: "left" }));
      at(ctx, PX + PW / 2, y, pop, pop, () => {
        rr(ctx, -PW / 2, -PH / 2, PW, PH, 16); shape(ctx, C.white);
        // 点線：額面
        ctx.save(); ctx.strokeStyle = C.gray; ctx.lineWidth = 4; ctx.setLineDash([4, 12]); ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-PW / 2 + 22, 0); ctx.lineTo(PW / 2 - 22, 0); ctx.stroke(); ctx.restore();
      });
      // 線を左から引く。先頭にコイン
      const p = ramp(t, s0 + 0.5, s0 + 3.0);
      const x0 = PX + 26, x1 = PX + PW - 34;
      if (p > 0) {
        ctx.save(); ctx.strokeStyle = r.color; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath();
        const N = 60;
        for (let k = 0; k <= N * p; k++) { const x = lerp(x0, x1, k / N); const yy = y + r.f(x - x0); k ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
        ctx.stroke(); ctx.restore();
        const hx = lerp(x0, x1, p), hy = y + r.f(hx - x0);
        const c = track(t, s0 + 0.5, PLAY);
        at(ctx, hx, hy, c * 0.9, c, () => COIN[r.coin](ctx));
      }
      ctx.restore();
    });

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "point", x: 872, h: 330, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 372, floor: 532, w: 112, eyes: t < END ? "right" : "open", mouth: "rest", blinkAt: [1.6, 8.6] });
  },
});
