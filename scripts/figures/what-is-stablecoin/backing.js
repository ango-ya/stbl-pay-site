// 価値を保つ仕組み（本文「ステーブルコインの仕組み：価格を保つ方法」の 1〜3）。
// 発行体が円を受け取ってステーブルコインを渡し、その額に見合う資産を裏付けとして持つ。持ち主が求めたら、額面どおりに円で払い戻す。
// 文字は 3 か所（持ち主・発行体・裏付け）。円はお札、ステーブルコインは青いコイン。裏付けの箱の円 2 枚は、すでに出回っているステーブルコイン 2 枚分
// （1 枚は持ち主の手元にある）。新しく発行すると箱に 1 枚足され、払い戻すと 1 枚出ていく。
FX.figure({
  duration: 10,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, arrow, along, track, ramp, lerp, rr, shape, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const BUY = [150, 350], WIN = [400, 128], BOX = [560, 322];
    const S = 1.45;
    const A1 = { a: [BUY[0] + 16, BUY[1] - 96], b: [WIN[0] - 94, WIN[1] + 6], ctrl: [BUY[0] + 16, WIN[1] + 6] }; // 持ち主 → 発行体
    const A2 = { a: [WIN[0] + 4, WIN[1] + 82], b: [BUY[0] + 66, BUY[1] - 34], ctrl: [WIN[0] + 4, BUY[1] - 34] }; // 発行体 → 持ち主
    const REST = [BUY[0] + 52, BUY[1] - 100];
    const SLOT = [[BOX[0] - 52, BOX[1] - 26], [BOX[0] + 52, BOX[1] - 26], [BOX[0] - 52, BOX[1] + 30]];
    const BANK = [WIN[0], WIN[1] + 6];

    const node = (p, start, icon, label, side = false) => {
      const s = track(t, start, SNAP);
      at(ctx, p[0], p[1], s * S, s, () => ICON[icon](ctx));
      const a = ramp(t, start + 0.1, start + 0.4);
      if (side) at(ctx, p[0] + 96, p[1] + 8, 1, a, () => text(ctx, label, 0, 0, { size: 40, align: "left" }));
      else at(ctx, p[0], p[1] + 112, 1, a, () => text(ctx, label, 0, 0, { size: 40 }));
    };
    node(BUY, 0.0, "phone", "持ち主");
    node(WIN, 0.35, "bank", "発行体", true);

    // 裏付けの箱（ほかの持ち主の分の円が 2 枚入っている）
    const bs = track(t, 0.7, SNAP);
    at(ctx, BOX[0], BOX[1], bs, bs, () => {
      rr(ctx, -118, -76, 236, 152, 18); shape(ctx, C.white);
      for (const k of [0, 1]) { const q = SLOT[k]; at(ctx, q[0] - BOX[0], q[1] - BOX[1], 0.95, 1, () => COIN.yen(ctx)); }
    });
    at(ctx, BOX[0], BOX[1] + 112, 1, ramp(t, 0.8, 1.1), () => text(ctx, "裏付け", 0, 0, { size: 40 }));

    // 矢印（出たあとは残す。行きは 1 の円と 3 のステーブルコイン、帰りは 2 のステーブルコインと 3 の円が通る）
    const u1 = track(t, 2.0, HEAVY);
    arrow(ctx, A1.a, A1.b, u1, { ctrl: A1.ctrl, color: C.gray, width: 6 });
    const u2 = track(t, 4.0, HEAVY);
    arrow(ctx, A2.a, A2.b, u2, { ctrl: A2.ctrl, color: C.gray, width: 6 });

    let watch = null;
    // 持ち主がすでに持っているステーブルコイン 1 枚（箱の円 2 枚のうちの 1 枚分）
    const k = track(t, 1.0, PLAY);
    at(ctx, BUY[0] - 54, BUY[1] - 100, k * 1.3, k, () => COIN.stable(ctx));
    // 円（持ち主が渡した 1 枚）：持ち主 → 発行体 → 裏付けの箱。払い戻しのときは、箱 → 発行体 → 持ち主
    const py = track(t, 1.4, PLAY);
    if (py > 0) {
      let pos = A1.a;
      if (u1 > 0) pos = along(A1.a, A1.b, u1, A1.ctrl);
      if (t >= 3.0) { const q = ramp(t, 3.0, 3.8); pos = [lerp(A1.b[0], SLOT[2][0], q), lerp(A1.b[1], SLOT[2][1], q) - Math.sin(Math.PI * q) * 36]; }
      if (t >= 7.2) {
        const q = ramp(t, 7.2, 7.9), u4 = track(t, 8.0, HEAVY);
        pos = u4 > 0 ? along(A2.a, A2.b, u4, A2.ctrl) : [lerp(SLOT[2][0], A2.a[0], q), lerp(SLOT[2][1], A2.a[1], q) - Math.sin(Math.PI * q) * 36];
        if (u4 > 0.999) pos = [lerp(A2.b[0], REST[0], ramp(t, 8.7, 9.0)), lerp(A2.b[1], REST[1], ramp(t, 8.7, 9.0))];
      }
      at(ctx, pos[0], pos[1], py * 1.3, 1, () => COIN.yen(ctx));
      if (t < 8.8) watch = pos;
    }
    // ステーブルコイン：発行体 → 持ち主。払い戻しのときは、持ち主 → 発行体で消える
    const pc = track(t, 3.9, PLAY);
    if (pc > 0 && t < 7.2) {
      let pos = BANK;
      if (u2 > 0) pos = along(A2.a, A2.b, u2, A2.ctrl);
      if (u2 > 0.999) pos = [lerp(A2.b[0], REST[0], ramp(t, 4.7, 5.0)), lerp(A2.b[1], REST[1], ramp(t, 4.7, 5.0))];
      if (t >= 5.9) {
        const u3 = track(t, 6.2, HEAVY), q = ramp(t, 5.9, 6.2);
        pos = u3 > 0 ? along(A1.a, A1.b, u3, A1.ctrl) : [lerp(REST[0], A1.a[0], q), lerp(REST[1], A1.a[1], q)];
      }
      const gone = 1 - ramp(t, 6.95, 7.15);
      at(ctx, pos[0], pos[1], pc * 1.3 * gone, 1, () => COIN.stable(ctx));
      watch = pos;
    }

    drawChan(ctx, t, { pose: t < 1.3 ? "normal" : "palm", x: 872, h: 340, blinkAt: [0.8] });
    const dx = watch ? watch[0] - 372 : 0;
    drawKun(ctx, t, { x: 372, floor: 532, w: 112, eyes: dx > 60 ? "right" : dx < -60 ? "left" : "open", mouth: t > 3.9 && t < 4.6 ? "o" : "rest", blinkAt: [1.0, 8.4] });
  },
});
