// チャージバックの流れ（本文「チャージバックの仕組み」の 1〜3）。
// 購入者がカード発行会社に取り消し・返金を求め（紙）、カード発行会社が受け入れるとお店に伝える。お店が受け入れると、返金額はお店から購入者へ戻る。
// 文字は 3 か所（購入者・カード発行会社・お店）。お金は ¥ のお札。
FX.figure({
  duration: 11,
  draw(ctx, t) {
    const { C, ICON, COIN, at, text, rr, shape, arrow, along, track, ramp, lerp, SNAP, HEAVY, PLAY, drawChan, drawKun } = FX;
    const Y = 262, BUY = [110, Y], ISS = [355, Y], SHOP = [600, Y], S = 1.5;
    const paper = () => {
      rr(ctx, -24, -30, 48, 60, 6); shape(ctx, C.white);
      ctx.lineCap = "round";
      for (const y of [-14, -2, 10]) { ctx.beginPath(); ctx.moveTo(-12, y); ctx.lineTo(y === 10 ? 4 : 12, y); shape(ctx, null, C.blue, 5); }
    };
    const node = (p, start, icon, label) => {
      const s = track(t, start, SNAP);
      at(ctx, p[0], p[1], s * S, s, () => ICON[icon](ctx));
      at(ctx, p[0], p[1] + 116, 1, ramp(t, start + 0.1, start + 0.4), () => text(ctx, label, 0, 0, { size: 40 }));
    };
    node(BUY, 0.0, "phone", "購入者");
    node(ISS, 0.35, "card", "カード\n発行会社");
    node(SHOP, 0.7, "shop", "お店");

    // 1. 購入者が、カード発行会社に求める（紙が運ばれる）。2. カード発行会社が、お店に求める
    const A1 = { a: [BUY[0] + 60, Y], b: [ISS[0] - 92, Y] }, A2 = { a: [ISS[0] + 92, Y], b: [SHOP[0] - 96, Y] };
    const u1 = track(t, 2.0, HEAVY), u2 = track(t, 3.8, HEAVY);
    arrow(ctx, A1.a, A1.b, u1, { color: C.gray, width: 6, dash: [2, 12] });
    arrow(ctx, A2.a, A2.b, u2, { color: C.gray, width: 6, dash: [2, 12] });
    let pp = null;
    const pop = track(t, 1.7, PLAY);
    if (t < 5.4) {
      pp = u2 > 0 ? along(A2.a, A2.b, u2) : along(A1.a, A1.b, u1);
      const gone = 1 - ramp(t, 5.1, 5.4);
      at(ctx, pp[0], pp[1] - 62 * ramp(t, 1.9, 2.2), pop * 1.0, gone * pop, paper);
    }

    // 3. お店が受け入れると、お金がお店から購入者へ戻る（上を回る）
    const R = { a: [SHOP[0] - 20, Y - 100], b: [BUY[0] + 20, Y - 100], ctrl: [355, Y - 262] };
    const u3 = track(t, 6.0, HEAVY);
    arrow(ctx, R.a, R.b, u3, { ctrl: R.ctrl, color: C.blue, width: 6 });
    const c = track(t, 5.6, PLAY);
    const cp = u3 > 0 ? along(R.a, R.b, u3 * 0.78, R.ctrl) : [SHOP[0] - 20, Y - 100]; // 矢じりが見えるよう、コインは終点の手前で止める
    at(ctx, cp[0], cp[1], c * 1.15, c, () => COIN.yen(ctx));

    drawChan(ctx, t, { pose: t < 1.0 ? "normal" : "palm", x: 872, h: 340, blinkAt: [0.6] });
    const watch = t < 5.4 && pp ? pp[0] : t > 5.6 ? cp[0] : 372;
    const dx = watch - 372;
    drawKun(ctx, t, { x: 372, floor: 532, w: 112, eyes: dx > 70 ? "right" : dx < -70 ? "left" : "open", mouth: t > 6.0 && t < 7.0 ? "o" : "rest", blinkAt: [1.0, 9.6] });
  },
});
