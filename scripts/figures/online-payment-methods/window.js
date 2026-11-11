// 導入の窓口（本文「導入の窓口：決済代行でまとめるか、カートの決済を使うか」）。
// 決済方法を一つずつ契約すると、契約が方法の数だけ要る。決済代行会社でまとめると、1 社との契約で複数の決済方法が使える。
// 文字は 2 か所（各段の名前）。契約は書類の印で表す。決済代行会社は運営（すてぶるペイ）ではない別の会社なので、箱だけで描く。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, lerp, track, ramp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const doc = () => { // 契約の書類
      rr(ctx, -16, -21, 32, 42, 4); shape(ctx, C.white, C.navy, 4);
      for (const y of [-8, 2, 12]) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(8, y); shape(ctx, null, C.light, 3.5); }
    };
    const hub = () => { // 決済代行会社：複数の方法を束ねる箱
      rr(ctx, -46, -40, 92, 80, 14); shape(ctx, C.blue);
      for (const y of [-18, 0, 18]) { ctx.beginPath(); ctx.arc(26, y, 6, 0, Math.PI * 2); shape(ctx, C.white, null); }
      ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(8, 0); shape(ctx, null, C.white, 6);
    };
    const METHODS = [() => ICON.card(ctx), () => COIN.yen(ctx), null]; // null は QR（下で描く）
    const qr = () => {
      rr(ctx, -42, -42, 84, 84, 8); shape(ctx, C.white);
      for (const [x, y] of [[-30, -30], [8, -30], [-30, 8]]) {
        rr(ctx, x, y, 22, 22, 3); shape(ctx, C.navy, null);
        rr(ctx, x + 6, y + 6, 10, 10, 1); shape(ctx, C.white, null);
      }
      for (const [x, y] of [[10, 10], [26, 10], [18, 22], [10, 28], [28, 28]]) { rr(ctx, x - 4, y - 4, 8, 8, 1); shape(ctx, C.navy, null); }
    };
    const icons = [() => ICON.card(ctx), () => COIN.yen(ctx), qr];
    const SC = [0.8, 1.1, 0.72]; // 方法ごとの大きさ（見た目の大きさをそろえる）
    const XM = 640;
    const END = 7.6;

    const rowA = { y: 148, start: 0.2 }, rowB = { y: 410, start: 4.1 };
    const dimA = t >= rowB.start ? 1 - 0.62 * ramp(t, rowB.start, rowB.start + 0.3) * (1 - ramp(t, END, END + 0.4)) : 1;

    // 段 A：一つずつ契約。3 本の線の途中に、それぞれ契約の書類
    ctx.save(); ctx.globalAlpha = dimA;
    {
      const y = rowA.y, s0 = rowA.start, shop = [170, y];
      at(ctx, 36, 40, 1, ramp(t, s0, s0 + 0.3), () => text(ctx, "一つずつ契約", 0, 0, { size: 40, align: "left" }));
      const sp = track(t, s0 + 0.1, SNAP);
      at(ctx, shop[0], shop[1], sp * 1.0, sp, () => ICON.shop(ctx));
      [-72, 0, 72].forEach((dy, k) => {
        const d = 0.5 + 0.55 * k, to = [XM, y + dy];
        const u = track(t, s0 + d, HEAVY);
        arrow(ctx, [shop[0] + 62, shop[1]], [to[0] - 62, to[1]], u, { color: C.gray, width: 5, head: false });
        const m = track(t, s0 + d + 0.05, SNAP);
        at(ctx, XM, to[1], m * SC[k] * 1.0, m, icons[k]);
        const dp = track(t, s0 + d + 0.6, PLAY);
        at(ctx, lerp(shop[0] + 62, to[0] - 62, 0.72), lerp(shop[1], to[1], 0.72), dp * 1.1, dp, doc);
      });
    }
    ctx.restore();

    // 段 B：決済代行会社でまとめる。1 社との契約（書類 1 枚）で、複数の方法
    {
      const y = rowB.y, s0 = rowB.start, shop = [170, y], HUB = [400, y];
      at(ctx, 36, 292, 1, ramp(t, s0, s0 + 0.3), () => text(ctx, "決済代行会社でまとめる", 0, 0, { size: 40, align: "left" }));
      const sp = track(t, s0 + 0.1, SNAP);
      at(ctx, shop[0], shop[1], sp * 1.0, sp, () => ICON.shop(ctx));
      const u0 = track(t, s0 + 0.6, HEAVY);
      arrow(ctx, [shop[0] + 62, y], [HUB[0] - 62, y], u0, { color: C.blue, width: 6, head: false });
      const h = track(t, s0 + 0.9, SNAP);
      at(ctx, HUB[0], HUB[1], h * 1.0, h, hub);
      const dp = track(t, s0 + 1.1, PLAY);
      at(ctx, lerp(shop[0] + 62, HUB[0] - 62, 0.5), y, dp, dp, doc);
      [-72, 0, 72].forEach((dy, k) => {
        const d = 1.8 + 0.25 * k, to = [XM, y + dy];
        const u = track(t, s0 + d, HEAVY);
        arrow(ctx, [HUB[0] + 52, y], [to[0] - 62, to[1]], u, { color: C.blue, width: 5, head: false });
        const m = track(t, s0 + d + 0.05, SNAP);
        at(ctx, XM, to[1], m * SC[k], m, icons[k]);
      });
    }

    drawChan(ctx, t, { pose: t < 0.6 ? "normal" : "palm", x: 872, h: 330, blinkAt: [0.3] });
    drawKun(ctx, t, { x: 60, floor: 532, w: 100, eyes: t > END ? "open" : t < rowB.start ? "open" : "right", mouth: t > rowB.start + 1.6 && t < rowB.start + 2.4 ? "o" : "rest", blinkAt: [2.5, 8.6] });
  },
});
