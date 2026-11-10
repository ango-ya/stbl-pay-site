// 決済手段を一つに頼らない（本文「同人・成人向け作品の販売者が決済を確保するには」）。
// カード・銀行振込・ステーブルコイン決済を並べておくと、カードが止まっても、ほかの手段で受け取れる（コンビニ払いなども候補）。
// ステーブルコイン決済にも、提供元の規約による停止の可能性はある（本文どおり。図の alt・figcaption に書く）。文字は 3 か所（各手段の名前）。
FX.figure({
  duration: 11,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, arrow, along, rr, shape, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const SHOP = [628, 262], X = 300, S = 1.0;
    const ROWS = [
      { y: 96, label: "カード", icon: "card", coin: "yen", start: 0.2, stopAt: 4.6 },
      { y: 262, label: "銀行振込", icon: "bank", coin: "yen", start: 0.45, stopAt: null },
      { y: 428, label: "ステーブル\nコイン", icon: "chain", coin: "stable", start: 0.7, stopAt: null },
    ];
    const stopMark = () => {
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); shape(ctx, C.navy, C.white, 4);
      rr(ctx, -15, -5, 30, 10, 3); shape(ctx, C.white, null);
    };

    const sp = track(t, 0.9, SNAP);
    at(ctx, SHOP[0], SHOP[1], sp * 1.5, sp, () => ICON.shop(ctx));

    ROWS.forEach((r, i) => {
      const s0 = r.start;
      const pop = track(t, s0, SNAP);
      at(ctx, 36, r.y, 1, ramp(t, s0, s0 + 0.3), () => text(ctx, r.label, 0, 0, { size: 40, align: "left" }));
      const out = r.stopAt ? ramp(t, r.stopAt, r.stopAt + 0.4) : 0; // 止まったカードは薄くなる
      ctx.save();
      ctx.globalAlpha = 1 - 0.55 * out;
      at(ctx, X, r.y, pop * S, pop, () => (r.icon === "chain" ? ICON.chain(ctx, 3) : ICON[r.icon](ctx)));
      ctx.restore();

      // 支払いの流れ：手段 → お店。カードは途中から点線の灰色になって止まる
      const a = [X + 62, r.y + (SHOP[1] - r.y) * 0.1], b = [SHOP[0] - 96, SHOP[1] + (r.y - SHOP[1]) * 0.28];
      const go = [1.8, 3.0, 3.6][i]; // 手段ごとに、時間をずらして
      const u = track(t, go, HEAVY);
      const cut = r.stopAt && t > r.stopAt;
      arrow(ctx, a, b, u, { color: cut ? C.gray : C.blue, width: 6, dash: cut ? [2, 12] : null });
      if (r.stopAt) {
        // カードの 1 回め：お金が届く。そのあと止まる
        const c = track(t, go - 0.3, PLAY) * (1 - ramp(t, r.stopAt, r.stopAt + 0.3));
        const p = along(a, b, u);
        at(ctx, p[0], p[1] - 30, c * 0.95, 1, () => COIN[r.coin](ctx));
        const st = track(t, r.stopAt, PLAY);
        at(ctx, X + 56, r.y - 36, st, st, stopMark);
      } else {
        const c = track(t, go - 0.3, PLAY) * (1 - ramp(u, 0.86, 1)); // お店に届いたら消える（確認の印に替わる）
        const p = along(a, b, u);
        at(ctx, p[0], p[1] - 30, c * 0.95, 1, () => COIN[r.coin](ctx));
      }
    });
    // 銀行振込とステーブルコイン決済が届いたら、お店に確認の印
    const ok = track(t, 5.6, PLAY);
    at(ctx, SHOP[0] + 82, SHOP[1] - 100, ok * 1.4, ok, () => ICON.check(ctx));

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "palm", x: 872, h: 340, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 480, floor: 532, w: 112, eyes: t > 4.4 && t < 5.4 ? "left" : "open", mouth: t > 4.6 && t < 5.4 ? "o" : "rest", blinkAt: [2.2, 8.6] });
  },
});
